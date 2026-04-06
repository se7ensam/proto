import { useState } from 'react'
import { apiService } from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Share2, UserPlus, Search } from 'lucide-react'

export default function ShareChatModal() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{id: string, email: string}[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await apiService.searchUsers(query)
      setResults(res.users)
    } catch (e: any) {
      setError(e.message || 'Error finding users')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (userId: string, email: string) => {
    try {
      setLoading(true)
      await apiService.addMember(userId)
      setSuccessMsg(`Successfully invited ${email}!`)
    } catch (e: any) {
      setError(e.message || 'Error adding member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share to Group Chat</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search user by email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {successMsg && <div className="text-green-500 text-sm">{successMsg}</div>}
          
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {results.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-2 border rounded-md">
                <span className="text-sm truncate mr-2">{user.email}</span>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => handleAddMember(user.id, user.email)}
                  disabled={loading}
                  className="shrink-0"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            ))}
            {results.length === 0 && !loading && query && (
              <div className="text-sm text-muted-foreground text-center py-4">No users found.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
