import path from "path"
import fs from "fs/promises"
import { Global } from "@/global"
import { Log } from "@/util/log"

const COLLAB_URL = "https://anycode-collab.anymousxe-info.workers.dev"
const tokenFile = path.join(Global.Path.data, "github-token")
const logger = Log.create()

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

async function collabApi(path: string, opts?: RequestInit) {
  const token = await GitHub.getToken()
  const res = await fetch(`${COLLAB_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  })
  return res.json()
}

export const GitHub = {
  async getToken(): Promise<string | null> {
    try {
      return (await fs.readFile(tokenFile, "utf-8")).trim()
    } catch { return null }
  },

  async setToken(token: string) {
    await fs.mkdir(path.dirname(tokenFile), { recursive: true })
    await fs.writeFile(tokenFile, token, { mode: 0o600 })
  },

  async removeToken() {
    try { await fs.unlink(tokenFile) } catch {}
  },

  async isLoggedIn(): Promise<boolean> {
    const token = await GitHub.getToken()
    if (!token || token.length < 10) return false
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${token}`, "User-Agent": "anycode" },
      })
      if (!res.ok) {
        await GitHub.removeToken()
        return false
      }
      return true
    } catch { return false }
  },

  async getUser(): Promise<GitHubUser> {
    const token = await GitHub.getToken()
    if (!token) throw new Error("Not logged in")
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}`, "User-Agent": "anycode" },
    })
    if (!res.ok) throw new Error("GitHub auth failed")
    return res.json()
  },

  async startDeviceFlow(): Promise<{ device_code: string; user_code: string; verification_uri: string; interval: number; expires_in: number; _alt?: boolean }> {
    const res = await fetch(`${COLLAB_URL}/auth/device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return res.json()
  },

  async pollDeviceToken(device_code: string, alt?: boolean): Promise<{ access_token: string; user: { login: string; avatar_url: string; name: string } } | { error: string }> {
    const res = await fetch(`${COLLAB_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code, alt }),
    })
    return res.json()
  },

  async loginWithFlow(flow: { device_code: string; interval: number; expires_in: number; _alt?: boolean }): Promise<GitHubUser> {
    const interval = flow.interval * 1000
    const deadline = Date.now() + flow.expires_in * 1000

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval))
      const result = await GitHub.pollDeviceToken(flow.device_code, flow._alt)
      if ("access_token" in result) {
        await GitHub.setToken(result.access_token)
        const user = await GitHub.getUser()
        return user
      }
      if (result.error !== "authorization_pending" && result.error !== "slow_down") {
        throw new Error(`Auth failed: ${result.error}`)
      }
    }
    throw new Error("Device flow expired")
  },

  async logout() {
    await GitHub.removeToken()
  },
}

export const Collab = {
  async getUser(): Promise<GitHubUser> {
    return GitHub.getUser()
  },

  async getRepos(): Promise<any[]> {
    return collabApi("/github/repos")
  },

  async createRepo(name: string, opts?: { private?: boolean; description?: string }): Promise<any> {
    return collabApi("/github/repos", {
      method: "POST",
      body: JSON.stringify({ name, ...opts }),
    })
  },

  async sendRequest(to: string): Promise<CollabRequest> {
    return collabApi("/collab/request", {
      method: "POST",
      body: JSON.stringify({ to }),
    })
  },

  async getRequests(): Promise<CollabRequest[]> {
    return collabApi("/collab/requests")
  },

  async respondRequest(id: string, action: "accepted" | "declined"): Promise<CollabRequest> {
    return collabApi("/collab/respond", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    })
  },

  async getCollabRepos(): Promise<any[]> {
    return collabApi("/collab/repos")
  },

  async sendChat(repo: string, from: string, body: string, type: "human" | "ai" = "human"): Promise<ChatMessage> {
    return collabApi("/collab/chat", {
      method: "POST",
      body: JSON.stringify({ repo, from, body, type }),
    })
  },

  async getChat(repo: string): Promise<ChatMessage[]> {
    return collabApi(`/collab/chat?repo=${encodeURIComponent(repo)}`)
  },

  async sendAiRequest(repo: string, fromUser: string, task: string): Promise<any> {
    return collabApi("/collab/ai-request", {
      method: "POST",
      body: JSON.stringify({ repo, fromUser, task }),
    })
  },

  async getAiRequests(repo: string): Promise<any[]> {
    return collabApi(`/collab/ai-requests?repo=${encodeURIComponent(repo)}`)
  },

  async respondAiRequest(repo: string, id: string, action: "accepted" | "declined"): Promise<any> {
    return collabApi("/collab/ai-respond", {
      method: "POST",
      body: JSON.stringify({ repo, id, action }),
    })
  },
}
