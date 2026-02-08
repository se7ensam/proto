/**
 * GitHub Integration Button Component
 * Shows in plan section to integrate with GitHub
 */

import { useState, useEffect } from 'react'
import { Github, Users, ExternalLink, Check, X, Clock } from 'lucide-react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { apiService } from '../services/api'
import { toast } from 'sonner'

interface GitHubIntegrationProps {
  conversationId: string
}

export function GitHubIntegration({ conversationId }: GitHubIntegrationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [integration, setIntegration] = useState<any>(null)
  const [isCheckingIntegration, setIsCheckingIntegration] = useState(true)

  // Check if already integrated
  useEffect(() => {
    checkIntegration()
  }, [conversationId])

  // Check for OAuth callback success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const githubIntegrated = urlParams.get('githubIntegrated')
    const repoUrl = urlParams.get('repoUrl')
    const githubError = urlParams.get('githubError')

    if (githubIntegrated === 'true' && repoUrl) {
      toast.success('GitHub repository created!', {
        description: `Repository: ${decodeURIComponent(repoUrl)}`,
        action: {
          label: 'View',
          onClick: () => window.open(decodeURIComponent(repoUrl), '_blank'),
        },
      })
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      checkIntegration()
    }

    if (githubError) {
      toast.error('GitHub integration failed', {
        description: decodeURIComponent(githubError),
      })
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const checkIntegration = async () => {
    try {
      setIsCheckingIntegration(true)
      const data = await apiService.getGitHubIntegration(conversationId)
      if (data.integrated) {
        setIntegration(data)
      }
    } catch (error) {
      console.error('Failed to check GitHub integration:', error)
    } finally {
      setIsCheckingIntegration(false)
    }
  }

  const handleIntegrate = async () => {
    setIsLoading(true)
    try {
      const response = await apiService.initiateGitHubAuth(
        conversationId,
        collaboratorEmail || undefined
      )

      // Redirect to GitHub OAuth
      window.location.href = response.authUrl
    } catch (error) {
      console.error('Failed to initiate GitHub auth:', error)
      toast.error('Failed to connect to GitHub', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect GitHub? This will not delete the repository.')) {
      return
    }

    try {
      await apiService.disconnectGitHub(conversationId)
      toast.success('GitHub disconnected')
      setIntegration(null)
    } catch (error) {
      toast.error('Failed to disconnect GitHub')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Active</Badge>
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
      case 'error':
        return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Error</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isCheckingIntegration) {
    return null
  }

  // Already integrated - show status
  if (integration) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            <span className="font-medium">GitHub Connected</span>
            {getStatusBadge(integration.integrationStatus)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="text-muted-foreground"
          >
            Disconnect
          </Button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Repository:</span>
            <a
              href={integration.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              {integration.repoFullName}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {integration.collaboratorUsername && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Collaborator:</span>
              <span>{integration.collaboratorUsername}</span>
              {getStatusBadge(integration.collaborationStatus)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Not integrated - show integration button
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Github className="h-4 w-4" />
          Integrate with GitHub
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Connect GitHub Repository
          </DialogTitle>
          <DialogDescription>
            Create a private GitHub repository for this project and optionally invite a collaborator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="collaborator">Collaborator Email (Optional)</Label>
            <Input
              id="collaborator"
              type="email"
              placeholder="teammate@example.com"
              value={collaboratorEmail}
              onChange={(e) => setCollaboratorEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              We'll search for this email on GitHub and invite them as a collaborator
            </p>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-2">What will be created:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Private GitHub repository</li>
              <li>• Automatic issue tracking</li>
              <li>• Collaborator invitation (if provided)</li>
              <li>• Project management setup</li>
            </ul>
          </div>

          <Button
            onClick={handleIntegrate}
            disabled={isLoading}
            className="w-full gap-2"
          >
            <Github className="h-4 w-4" />
            {isLoading ? 'Connecting...' : 'Connect GitHub & Create Repository'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
