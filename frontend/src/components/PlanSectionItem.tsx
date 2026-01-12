import { PlanSection } from '../types'

interface PlanSectionItemProps {
  section: PlanSection
  onLockSection: (sectionId: string) => void
}

export default function PlanSectionItem({
  section,
  onLockSection,
}: PlanSectionItemProps) {
  return (
    <div
      className={`p-4 rounded-lg border-2 ${
        section.locked
          ? 'bg-gray-50 border-gray-300'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {section.locked && (
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
              🔒 Locked
            </span>
          )}
        </div>
        <button
          onClick={() => onLockSection(section.id)}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            section.locked
              ? 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
          }`}
        >
          {section.locked ? 'Unlock' : 'Lock Section'}
        </button>
      </div>
      <div className="text-gray-800 whitespace-pre-wrap">{section.content}</div>
      <div className="text-xs text-gray-500 mt-2">
        {section.timestamp.toLocaleString()}
      </div>
    </div>
  )
}
