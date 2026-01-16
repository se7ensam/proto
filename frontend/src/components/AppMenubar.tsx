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
import { LogOut, Moon, Sun, Monitor, HelpCircle, Info } from "lucide-react"

interface AppMenubarProps {
  onLogout: () => void
}

export function AppMenubar({ onLogout }: AppMenubarProps) {
  const { setTheme } = useTheme()

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
        <Menubar className="border-none shadow-none bg-transparent">
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                New Conversation <MenubarShortcut>⌘N</MenubarShortcut>
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
