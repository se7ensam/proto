import { PlanSection } from '../types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock, Bot, Reply } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlanSectionItemProps {
  section: PlanSection
  onLockSection: (sectionId: string) => void
}

export default function PlanSectionItem({
  section,
  onLockSection,
}: PlanSectionItemProps) {
  // Truncate source message for preview (WhatsApp style)
  const getMessagePreview = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content
    return content.slice(0, maxLength).trim() + '...'
  }

  return (
    <Card className={cn(
      "transition-all",
      section.locked 
        ? "bg-muted/50 border-2 border-muted-foreground/20" 
        : "bg-card hover:shadow-md"
    )}>
      <CardContent className="p-4">
        {/* WhatsApp-style quoted message reference */}
        {section.sourceMessage && (
          <div className="mb-3 rounded-md bg-muted/50 border-l-4 border-primary overflow-hidden">
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">AI Response</span>
                <Reply className="h-3 w-3 text-muted-foreground ml-auto" />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {getMessagePreview(section.sourceMessage.content)}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {section.locked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            )}
          </div>
          <Button
            variant={section.locked ? "secondary" : "outline"}
            size="sm"
            onClick={() => onLockSection(section.id)}
            className="gap-1.5 h-8"
          >
            {section.locked ? (
              <>
                <Unlock className="h-3.5 w-3.5" />
                Unlock
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                Lock Section
              </>
            )}
          </Button>
        </div>
        <div className={cn(
          "whitespace-pre-wrap text-sm",
          section.locked ? "text-muted-foreground" : "text-foreground"
        )}>
          {section.content}
        </div>
        <div className="text-xs text-muted-foreground mt-3 pt-2 border-t">
          {section.timestamp.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
