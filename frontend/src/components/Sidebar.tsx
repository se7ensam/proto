import { Button } from '@/components/ui/button'
import { PlusCircle, MessageSquare, Users } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SidebarProps {
  conversations: any[]
  activeId: string
  currentUserId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
}

export function Sidebar({ conversations, activeId, currentUserId, onSelect, onNewChat }: SidebarProps) {
  const ownedChats = conversations.filter(c => c.userId === currentUserId)
  const sharedChats = conversations.filter(c => c.userId !== currentUserId)

  return (
    <div className="w-64 flex flex-col h-full border-r bg-muted/20">
      <div className="p-4 border-b">
        <Button onClick={onNewChat} className="w-full gap-2" variant="default">
          <PlusCircle className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1 p-3">
        {ownedChats.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              My Chats
            </h3>
            <div className="space-y-1">
              {ownedChats.map((chat) => (
                <Button
                  key={chat.id}
                  variant={activeId === chat.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-left font-normal truncate"
                  onClick={() => onSelect(chat.id)}
                >
                  <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Chat {chat.id.substring(0, 6)}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {sharedChats.length > 0 && (
          <div>
            <h3 className="mb-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Shared with me
            </h3>
            <div className="space-y-1">
              {sharedChats.map((chat) => (
                <Button
                  key={chat.id}
                  variant={activeId === chat.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-left font-normal truncate"
                  onClick={() => onSelect(chat.id)}
                >
                  <Users className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Chat {chat.id.substring(0, 6)}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
