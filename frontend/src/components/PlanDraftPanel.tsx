import { PlanSection } from '../types'
import PlanSectionItem from './PlanSectionItem'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Sparkles } from 'lucide-react'

interface PlanDraftPanelProps {
  sections: PlanSection[]
  onLockSection: (sectionId: string) => void
}

export default function PlanDraftPanel({
  sections,
  onLockSection,
}: PlanDraftPanelProps) {
  return (
    <Card className="flex flex-col h-full rounded-none border-0">
      <CardHeader className="border-b bg-muted/50 py-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FileText className="h-5 w-5 text-primary" />
          Plan Draft
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          Live updates from applied AI suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-4">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground mt-16">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No plan sections yet</p>
            <p className="text-sm text-center max-w-xs">
              Apply AI suggestions from the chat to build your plan
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <PlanSectionItem
                key={section.id}
                section={section}
                onLockSection={onLockSection}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
