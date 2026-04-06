import { useEffect, useState } from 'react'
import { ConversationSummary } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  RotateCcw,
  Square,
  CheckSquare,
  Check,
  X,
  Trash2,
} from 'lucide-react'

interface ConversationSidebarProps {
  conversations: ConversationSummary[]
  activeConversationId: string | null
  collapsed: boolean
  onToggleCollapse: () => void
  onSelectConversation: (conversationId: string) => void
  onNewConversation: () => void
  onRenameConversation: (conversationId: string, title: string) => Promise<void>
  onDeleteConversation: (conversationId: string) => void
  onRestoreConversation: (conversationId: string) => void
  onRestoreSelectedConversations: (conversationIds: string[]) => void
  onRestoreAllConversations: () => void
  canCreateConversation: boolean
  deletedConversations: ConversationSummary[]
  isRestoringDeletedConversations?: boolean
}

function formatConversationLabel(conversation: ConversationSummary): string {
  const title = conversation.title?.trim()
  if (title) {
    return title
  }

  const dateLabel = conversation.updatedAt.toLocaleDateString()
  const timeLabel = conversation.updatedAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `Chat ${dateLabel} ${timeLabel}`
}

export default function ConversationSidebar({
  conversations,
  activeConversationId,
  collapsed,
  onToggleCollapse,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onRestoreConversation,
  onRestoreSelectedConversations,
  onRestoreAllConversations,
  canCreateConversation,
  deletedConversations,
  isRestoringDeletedConversations = false,
}: ConversationSidebarProps) {
  const visibleConversations = conversations.slice(0, 50)
  const visibleDeletedConversations = deletedConversations.slice(0, 20)
  const [isRecycleBinCollapsed, setIsRecycleBinCollapsed] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedDeletedConversationIds, setSelectedDeletedConversationIds] = useState<string[]>([])
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null)

  useEffect(() => {
    const validIds = new Set(visibleDeletedConversations.map((conversation) => conversation.id))
    setSelectedDeletedConversationIds((prev) => prev.filter((id) => validIds.has(id)))
  }, [visibleDeletedConversations])

  const toggleSelectionMode = () => {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedDeletedConversationIds([])
      }
      return !prev
    })
  }

  const toggleDeletedConversationSelection = (conversationId: string) => {
    setSelectedDeletedConversationIds((prev) => {
      if (prev.includes(conversationId)) {
        return prev.filter((id) => id !== conversationId)
      }
      return [...prev, conversationId]
    })
  }

  const startEditingConversation = (conversation: ConversationSummary) => {
    setEditingConversationId(conversation.id)
    setEditingTitle(formatConversationLabel(conversation))
  }

  const cancelEditingConversation = () => {
    setEditingConversationId(null)
    setEditingTitle('')
  }

  const saveConversationTitle = async (conversation: ConversationSummary) => {
    const normalizedTitle = editingTitle.trim().replace(/\s+/g, ' ')
    if (!normalizedTitle) {
      return
    }

    const currentTitle = formatConversationLabel(conversation)
    if (normalizedTitle === currentTitle) {
      cancelEditingConversation()
      return
    }

    setRenamingConversationId(conversation.id)
    try {
      await onRenameConversation(conversation.id, normalizedTitle)
      cancelEditingConversation()
    } catch {
      // Errors are surfaced by the parent.
    } finally {
      setRenamingConversationId(null)
    }
  }

  return (
    <aside
      className={cn(
        'border-r bg-gradient-to-b from-background to-muted/20 transition-[width] duration-75 ease-out will-change-[width]',
        collapsed ? 'w-16' : 'w-72'
      )}
      aria-label="Conversations"
    >
      <div className="flex h-full flex-col">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 border-b p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewConversation}
              disabled={!canCreateConversation}
              className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="New conversation"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-b p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">Chats</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewConversation}
              disabled={!canCreateConversation}
              className="ml-auto h-9 w-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="New conversation"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className={cn('flex-1 overflow-y-auto', collapsed ? 'p-2' : 'p-2')}>
          {visibleConversations.length === 0 ? (
            <div className={cn('py-3 text-xs text-muted-foreground', collapsed ? 'text-center' : 'px-2')}>
              {collapsed ? '•' : 'No chats yet'}
            </div>
          ) : (
            <div className={cn('space-y-1', collapsed && 'space-y-2')}>
              {visibleConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn('group', collapsed ? '' : 'flex items-center gap-1')}
                >
                  {collapsed ? (
                    <button
                      type="button"
                      onClick={() => onSelectConversation(conversation.id)}
                      className="w-full rounded-xl p-1.5 transition-colors hover:bg-transparent focus-visible:outline-none"
                      title={formatConversationLabel(conversation)}
                    >
                      <span
                        className={cn(
                          'mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-xs font-semibold transition-colors',
                          conversation.id === activeConversationId
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-transparent text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                        )}
                        aria-hidden
                      >
                        <MessageSquare className="h-4 w-4" />
                      </span>
                    </button>
                  ) : editingConversationId === conversation.id ? (
                    <div
                      className={cn(
                        'min-w-0 flex-1 rounded-lg border px-2.5 py-2',
                        conversation.id === activeConversationId
                          ? 'border-primary/30 bg-primary/10'
                          : 'border-transparent'
                      )}
                    >
                      <input
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void saveConversationTitle(conversation)
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelEditingConversation()
                          }
                        }}
                        className="h-7 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        maxLength={120}
                        autoFocus
                        disabled={renamingConversationId === conversation.id}
                        aria-label="Edit conversation title"
                      />
                      <div className="truncate pt-1 text-xs text-muted-foreground">
                        {conversation.updatedAt.toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectConversation(conversation.id)}
                      className={cn(
                        'min-w-0 flex-1 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none',
                        conversation.id === activeConversationId && 'bg-accent text-accent-foreground'
                      )}
                      title={formatConversationLabel(conversation)}
                    >
                      <div
                        className={cn(
                          'rounded-lg border px-2.5 py-2 text-left',
                          conversation.id === activeConversationId
                            ? 'border-primary/30 bg-primary/10'
                            : 'border-transparent'
                        )}
                      >
                        <div className="truncate text-sm font-medium">{formatConversationLabel(conversation)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {conversation.updatedAt.toLocaleString()}
                        </div>
                      </div>
                    </button>
                  )}

                  {!collapsed && (
                    <>
                      {editingConversationId === conversation.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void saveConversationTitle(conversation)}
                            className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            aria-label="Save conversation title"
                            disabled={renamingConversationId === conversation.id}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEditingConversation}
                            className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            aria-label="Cancel editing conversation title"
                            disabled={renamingConversationId === conversation.id}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditingConversation(conversation)}
                            className="h-8 w-8 shrink-0 rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
                            aria-label="Rename conversation"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteConversation(conversation.id)}
                            className="h-8 w-8 shrink-0 rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            aria-label="Delete conversation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {!collapsed && (
            <div className="mt-4 border-t pt-3">
              <button
                type="button"
                onClick={() => setIsRecycleBinCollapsed((prev) => !prev)}
                className="mb-2 flex w-full items-center justify-between rounded-md px-1 py-1 text-left hover:bg-accent/50"
                aria-expanded={!isRecycleBinCollapsed}
                aria-label="Toggle recycle bin"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recycle Bin
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {visibleDeletedConversations.length}
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      isRecycleBinCollapsed ? '-rotate-90' : 'rotate-0'
                    )}
                  />
                </span>
              </button>

              {!isRecycleBinCollapsed &&
                (visibleDeletedConversations.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No deleted chats</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 px-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectionMode}
                        className="h-7 px-2 text-xs"
                        disabled={isRestoringDeletedConversations}
                      >
                        {isSelectionMode ? 'Cancel' : 'Select'}
                      </Button>
                      {isSelectionMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRestoreSelectedConversations(selectedDeletedConversationIds)}
                          className="h-7 px-2 text-xs"
                          disabled={
                            selectedDeletedConversationIds.length === 0 || isRestoringDeletedConversations
                          }
                        >
                          Restore Selected ({selectedDeletedConversationIds.length})
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRestoreAllConversations}
                        className="ml-auto h-7 px-2 text-xs"
                        disabled={visibleDeletedConversations.length === 0 || isRestoringDeletedConversations}
                      >
                        Restore All
                      </Button>
                    </div>

                    <div className="space-y-1">
                    {visibleDeletedConversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className="flex items-center gap-1 rounded-lg border border-dashed px-2 py-1.5"
                      >
                        {isSelectionMode && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleDeletedConversationSelection(conversation.id)}
                            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            aria-label="Select conversation to restore"
                          >
                            {selectedDeletedConversationIds.includes(conversation.id) ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-muted-foreground">
                            {formatConversationLabel(conversation)}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground/80">
                            Deleted{' '}
                            {conversation.deletedAt
                              ? conversation.deletedAt.toLocaleString()
                              : conversation.updatedAt.toLocaleString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRestoreConversation(conversation.id)}
                          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          aria-label="Restore conversation"
                          title="Restore conversation"
                          disabled={isRestoringDeletedConversations}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
