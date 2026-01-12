import { PlanSection } from '../types'
import PlanSectionItem from './PlanSectionItem'

interface PlanDraftPanelProps {
  sections: PlanSection[]
  onLockSection: (sectionId: string) => void
}

export default function PlanDraftPanel({
  sections,
  onLockSection,
}: PlanDraftPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-800">Plan Draft</h1>
        <p className="text-sm text-gray-500 mt-1">
          Live updates from applied AI suggestions
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {sections.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No plan sections yet. Apply AI suggestions to build your plan.
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
      </div>
    </div>
  )
}
