const COLLAB_URL = "https://anycode-collab.anymousxe-info.workers.dev"

interface GitHubUser {
  login: string
  avatar_url: string
  html_url: string
  name: string | null
  bio: string | null
}

interface CollabRequest {
  id: string
  from: string
  to: string
  status: "pending" | "accepted" | "declined"
  repo?: string
  createdAt: number
}

interface ChatMessage {
  id: string
  from: string
  body: string
  timestamp: number
  type: "human" | "ai"
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${COLLAB_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: "Bearer anycode",
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  })
  return res.json()
}

export const Collab = {
  async getUser(): Promise<GitHubUser> {
    return api("/github/user")
  },

  async getRepos(): Promise<any[]> {
    return api("/github/repos")
  },

  async createRepo(name: string, opts?: { private?: boolean; description?: string }): Promise<any> {
    return api("/github/repos", {
      method: "POST",
      body: JSON.stringify({ name, ...opts }),
    })
  },

  async sendRequest(to: string): Promise<CollabRequest> {
    return api("/collab/request", {
      method: "POST",
      body: JSON.stringify({ to }),
    })
  },

  async getRequests(): Promise<CollabRequest[]> {
    return api("/collab/requests")
  },

  async respondRequest(id: string, action: "accepted" | "declined"): Promise<CollabRequest> {
    return api("/collab/respond", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    })
  },

  async getCollabRepos(): Promise<any[]> {
    return api("/collab/repos")
  },

  async sendChat(repo: string, from: string, body: string, type: "human" | "ai" = "human"): Promise<ChatMessage> {
    return api("/collab/chat", {
      method: "POST",
      body: JSON.stringify({ repo, from, body, type }),
    })
  },

  async getChat(repo: string): Promise<ChatMessage[]> {
    return api(`/collab/chat?repo=${encodeURIComponent(repo)}`)
  },

  async sendAiRequest(repo: string, fromUser: string, task: string): Promise<any> {
    return api("/collab/ai-request", {
      method: "POST",
      body: JSON.stringify({ repo, fromUser, task }),
    })
  },

  async getAiRequests(repo: string): Promise<any[]> {
    return api(`/collab/ai-requests?repo=${encodeURIComponent(repo)}`)
  },

  async respondAiRequest(repo: string, id: string, action: "accepted" | "declined"): Promise<any> {
    return api("/collab/ai-respond", {
      method: "POST",
      body: JSON.stringify({ repo, id, action }),
    })
  },
}
