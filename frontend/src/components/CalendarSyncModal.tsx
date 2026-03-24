import { useMemo, useRef, useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { Badge } from '@/components/ui/badge'
import { CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'
import { PlanSection } from '../types'
import { apiService } from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface CalendarSyncModalProps {
  conversationId: string
  sections: PlanSection[]
  calendarEventsCreated?: boolean
  onCalendarSynced?: () => void
}

interface SyncConfig {
  startDate: string
  endDate: string
  includeSharedMembers: boolean
}

export default function CalendarSyncModal({
  conversationId,
  sections,
  calendarEventsCreated = false,
  onCalendarSynced,
}: CalendarSyncModalProps) {
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [includeSharedMembers, setIncludeSharedMembers] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** Ref avoids a race: `login()` can run before React applies `setState` for pending config. */
  const pendingConfigRef = useRef<SyncConfig | null>(null)

  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => {
      if (typeof a.phaseOrder === 'number' && typeof b.phaseOrder === 'number') {
        return a.phaseOrder - b.phaseOrder
      }
      return a.timestamp.getTime() - b.timestamp.getTime()
    })
  }, [sections])

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.events',
    onSuccess: async (tokenResponse) => {
      const pendingConfig = pendingConfigRef.current
      pendingConfigRef.current = null
      if (!pendingConfig) {
        setIsSubmitting(false)
        return
      }

      try {
        const attendeeEmails =
          pendingConfig.includeSharedMembers && conversationId !== 'default'
            ? await loadAttendeeEmails(conversationId)
            : []

        const events = buildEventsForDateRange(
          sortedSections,
          pendingConfig.startDate,
          pendingConfig.endDate,
          attendeeEmails
        )

        if (events.length === 0) {
          throw new Error('No events generated for selected date range')
        }

        const calendarUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all'
        const headers = {
          Authorization: `Bearer ${tokenResponse.access_token}`,
          'Content-Type': 'application/json',
        } as const

        for (const event of events) {
          const { sectionId, ...eventBody } = event
          const response = await fetch(calendarUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(eventBody),
          })
          if (!response.ok) {
            try {
              await apiService.updatePlanSection(conversationId, sectionId, {
                calendarEventStatus: 'failed',
              })
            } catch {
              /* best effort */
            }
            throw new Error('Failed to create one or more calendar events')
          }
          try {
            await apiService.updatePlanSection(conversationId, sectionId, {
              calendarEventStatus: 'created',
            })
          } catch (syncErr) {
            toast.warning(
              syncErr instanceof Error
                ? `${syncErr.message} — calendar item was still created`
                : 'Calendar item was created but plan status was not saved'
            )
          }
        }

        try {
          await apiService.setConversationCalendarEventsCreated(conversationId, true)
          onCalendarSynced?.()
          toast.success(`Added ${events.length} plan item(s) to Google Calendar`)
        } catch (syncErr) {
          toast.warning(
            syncErr instanceof Error
              ? `${syncErr.message} — events were still added in Google Calendar`
              : 'Events were added in Google Calendar, but sync status was not saved on the server'
          )
        }
        setOpen(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to sync calendar')
      } finally {
        setIsSubmitting(false)
      }
    },
    onError: () => {
      setIsSubmitting(false)
      pendingConfigRef.current = null
      toast.error('Google Calendar consent was not granted')
    },
  })

  const handleSync = async () => {
    if (conversationId === 'default') {
      toast.error('Create or open a saved chat first')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Start and end dates are required')
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date must be on or after start date')
      return
    }
    if (sortedSections.length === 0) {
      toast.error('No plan sections available to schedule')
      return
    }

    pendingConfigRef.current = { startDate, endDate, includeSharedMembers }
    setIsSubmitting(true)
    login()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-col items-end gap-1">
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" disabled={sections.length === 0}>
            <CalendarPlus className="h-4 w-4" />
            {calendarEventsCreated ? 'Add to Google Calendar again' : 'Add to Google Calendar'}
          </Button>
        </DialogTrigger>
        {calendarEventsCreated && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Calendar events created
          </Badge>
        )}
      </div>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Sync plan to calendars</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Start date</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">End date</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includeSharedMembers}
              onChange={(event) => setIncludeSharedMembers(event.target.checked)}
            />
            Invite shared chat members (email invites)
          </label>
          <p className="text-xs text-muted-foreground">
            You will be asked for Google consent before events are created.
          </p>
          <Button onClick={handleSync} disabled={isSubmitting}>
            {isSubmitting ? 'Syncing...' : 'Continue with Google'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

async function loadAttendeeEmails(conversationId: string): Promise<string[]> {
  const response = await apiService.getConversationMembers(conversationId)
  const currentUserEmail = apiService.userEmail
  const unique = new Set<string>()
  response.members.forEach((member) => {
    if (!member.email) return
    if (currentUserEmail && member.email === currentUserEmail) return
    unique.add(member.email)
  })
  return Array.from(unique)
}

function buildEventsForDateRange(
  sections: PlanSection[],
  startDateInput: string,
  endDateInput: string,
  attendeeEmails: string[]
): Array<{
  sectionId: string
  summary: string
  description: string
  start: { date: string }
  end: { date: string }
  attendees?: Array<{ email: string }>
}> {
  const startDate = new Date(`${startDateInput}T00:00:00`)
  const endDate = new Date(`${endDateInput}T00:00:00`)
  const dayCount = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  return sections.map((section, index) => {
    const dayOffset = dayCount === 1 ? 0 : Math.floor((index * (dayCount - 1)) / Math.max(1, sections.length - 1))
    const eventStart = new Date(startDate)
    eventStart.setDate(startDate.getDate() + dayOffset)
    const eventEnd = new Date(eventStart)
    eventEnd.setDate(eventStart.getDate() + 1)

    const summary = section.structuredData?.n || firstNonEmptyLine(section.content) || 'Plan item'
    const description = section.structuredData
      ? [section.structuredData.sum, ...section.structuredData.it.map((task) => `- ${task.c}`)].join('\n')
      : section.content

    return {
      sectionId: section.id,
      summary,
      description,
      start: { date: formatDate(eventStart) },
      end: { date: formatDate(eventEnd) },
      attendees: attendeeEmails.length > 0 ? attendeeEmails.map((email) => ({ email })) : undefined,
    }
  })
}

function firstNonEmptyLine(value: string): string {
  return value
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) || ''
}

function formatDate(value: Date): string {
  const yyyy = value.getFullYear().toString().padStart(4, '0')
  const mm = (value.getMonth() + 1).toString().padStart(2, '0')
  const dd = value.getDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
