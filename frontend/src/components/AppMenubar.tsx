import { Button } from "@/components/ui/button"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { ThemeToggle } from "./theme-toggle"
import { useTheme } from "next-themes"
import { LogOut, Moon, Sun, Monitor, HelpCircle, Info, Check, PlusCircle, Trash2 } from "lucide-react"
import { ConversationSummary } from "@/types"

interface AppMenubarProps {
  onLogout: () => void
  onNewConversation: () => void
  onDeleteConversation: () => void
  onSelectConversation: (conversationId: string) => void
  conversations: ConversationSummary[]
  activeConversationId: string | null
  canCreateConversation: boolean
  canDeleteConversation: boolean
}

export function AppMenubar({
  onLogout,
  onNewConversation,
  onDeleteConversation,
  onSelectConversation,
  conversations,
  activeConversationId,
  canCreateConversation,
  canDeleteConversation,
}: AppMenubarProps) {
  const { setTheme } = useTheme()
  const recentConversations = conversations.slice(0, 12)

  const getConversationLabel = (conversation: ConversationSummary) => {
    return (
      conversation.title?.trim() ||
      `Chat ${conversation.updatedAt.toLocaleDateString()} ${conversation.updatedAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
        <Menubar className="border-none shadow-none bg-transparent">
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={onNewConversation} disabled={!canCreateConversation}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Conversation <MenubarShortcut>⌘N</MenubarShortcut>
              </MenubarItem>
              {!canCreateConversation && (
                <MenubarItem disabled>
                  Send a message first
                </MenubarItem>
              )}
              <MenubarItem onClick={onDeleteConversation} disabled={!canDeleteConversation}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Current Conversation
              </MenubarItem>
              <MenubarItem>
                Export Plan <MenubarShortcut>⌘E</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Chats</MenubarTrigger>
            <MenubarContent>
              {recentConversations.length === 0 ? (
                <MenubarItem disabled>No chats yet</MenubarItem>
              ) : (
                recentConversations.map((conversation) => (
                  <MenubarItem
                    key={conversation.id}
                    onClick={() => onSelectConversation(conversation.id)}
                    className="flex items-center gap-2"
                  >
                    {conversation.id === activeConversationId ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="inline-block h-4 w-4" />
                    )}
                    <span className="truncate">{getConversationLabel(conversation)}</span>
                  </MenubarItem>
                ))
              )}
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Light Mode
              </MenubarItem>
              <MenubarItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Dark Mode
              </MenubarItem>
              <MenubarItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                System Theme
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                Documentation
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                <Info className="mr-2 h-4 w-4" />
                About
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>
      <div className="flex items-center gap-2">
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout}
            className="hidden md:flex gap-2 text-muted-foreground hover:text-foreground"
        >
            <LogOut className="h-4 w-4" />
            Logout
        </Button>
        <ThemeToggle />
      </div>
    </div>
  )
}
