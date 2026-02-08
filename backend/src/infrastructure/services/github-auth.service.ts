/**
 * GitHub OAuth and API Service
 * Handles authentication, repository creation, and GitHub API interactions
 */

import { Octokit } from '@octokit/rest'

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  html_url: string
  private: boolean
  owner: {
    login: string
  }
}

export class GitHubAuthService {
  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID || ''
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET || ''
    this.redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/github/auth/callback'

    if (!this.clientId || !this.clientSecret) {
      console.warn('GitHub OAuth credentials not configured. GitHub integration will not work.')
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'repo,user:email,write:org',
      state,
      allow_signup: 'true',
    })
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string): Promise<{
    access_token: string
    token_type: string
    scope: string
  }> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    })

    const data = await response.json()
    
    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`)
    }

    return data
  }

  /**
   * Get authenticated user information
   */
  async getUser(accessToken: string): Promise<GitHubUser> {
    const octokit = new Octokit({ auth: accessToken })
    
    const { data } = await octokit.users.getAuthenticated()
    
    // Get primary email if not public
    let email = data.email
    if (!email) {
      try {
        const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser()
        const primaryEmail = emails.find(e => e.primary && e.verified)
        email = primaryEmail?.email || emails[0]?.email || null
      } catch (error) {
        console.warn('Failed to fetch user emails:', error)
      }
    }
    
    return {
      id: data.id,
      login: data.login,
      name: data.name,
      email,
      avatar_url: data.avatar_url,
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(
    accessToken: string,
    name: string,
    description: string,
    isPrivate: boolean = true
  ): Promise<GitHubRepository> {
    const octokit = new Octokit({ auth: accessToken })
    
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true,
      has_issues: true,
      has_projects: true,
      has_wiki: false,
    })

    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      html_url: data.html_url,
      private: data.private,
      owner: {
        login: data.owner!.login,
      },
    }
  }

  /**
   * Add collaborator to repository
   */
  async addCollaborator(
    accessToken: string,
    owner: string,
    repo: string,
    username: string,
    permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage' = 'push'
  ): Promise<void> {
    const octokit = new Octokit({ auth: accessToken })
    
    await octokit.repos.addCollaborator({
      owner,
      repo,
      username,
      permission,
    })
  }

  /**
   * Check if user has accepted collaborator invitation
   */
  async checkCollaboratorStatus(
    accessToken: string,
    owner: string,
    repo: string,
    username: string
  ): Promise<'accepted' | 'pending' | 'none'> {
    const octokit = new Octokit({ auth: accessToken })
    
    try {
      // Check if user is a collaborator
      await octokit.repos.checkCollaborator({
        owner,
        repo,
        username,
      })
      return 'accepted'
    } catch (error: any) {
      if (error.status === 404) {
        // Check pending invitations
        try {
          const { data: invitations } = await octokit.repos.listInvitations({
            owner,
            repo,
          })
          
          const hasPending = invitations.some(inv => inv.invitee?.login === username)
          return hasPending ? 'pending' : 'none'
        } catch {
          return 'none'
        }
      }
      throw error
    }
  }

  /**
   * Create an issue in repository
   */
  async createIssue(
    accessToken: string,
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[] = []
  ): Promise<{
    number: number
    html_url: string
    id: number
  }> {
    const octokit = new Octokit({ auth: accessToken })
    
    const { data } = await octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    })

    return {
      number: data.number,
      html_url: data.html_url,
      id: data.id,
    }
  }

  /**
   * List repositories for authenticated user
   */
  async listUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
    const octokit = new Octokit({ auth: accessToken })
    
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    })

    return data.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      private: repo.private,
      owner: {
        login: repo.owner!.login,
      },
    }))
  }

  /**
   * Search for GitHub user by email
   */
  async searchUserByEmail(accessToken: string, email: string): Promise<string | null> {
    const octokit = new Octokit({ auth: accessToken })
    
    try {
      const { data } = await octokit.search.users({
        q: `${email} in:email`,
      })
      
      if (data.total_count > 0 && data.items[0]) {
        return data.items[0].login
      }
    } catch (error) {
      console.warn('GitHub user search by email failed:', error)
    }
    
    return null
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const octokit = new Octokit({ auth: accessToken })
      await octokit.users.getAuthenticated()
      return true
    } catch (error) {
      return false
    }
  }
}
