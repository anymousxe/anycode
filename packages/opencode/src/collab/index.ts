import path from "path"
import fs from "fs/promises"
import { Global } from "@/global"

const COLLAB_URL = "https://anycode-collab.anymousxe-info.workers.dev"
const dataDir = Global.Path.data
const tokenFile = path.join(dataDir, "github-token")
const loginFile = path.join(dataDir, "github-login")

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
  status: "pending" | "accepted" | "declined" | "cancelled"
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
  const [token, login] = await Promise.all([GitHub.getToken(), GitHub.getLogin()])
  if (token && !login) {
    await GitHub.backfillLogin()
  }
  const login2 = login ?? await GitHub.getLogin()
  const res = await fetch(`${COLLAB_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      "X-GitHub-Login": login2 ?? "",
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`API error ${res.status}: ${text}`)
  }
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

  async getLogin(): Promise<string | null> {
    try {
      return (await fs.readFile(loginFile, "utf-8")).trim()
    } catch { return null }
  },

  async setLogin(login: string) {
    await fs.mkdir(path.dirname(loginFile), { recursive: true })
    await fs.writeFile(loginFile, login)
  },

  async backfillLogin() {
    const token = await GitHub.getToken()
    if (!token) return
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${token}`, "User-Agent": "anycode" },
      })
      if (res.ok) {
        const user = await res.json()
        if (user.login) await GitHub.setLogin(user.login)
      }
    } catch {}
  },

  async removeToken() {
    try { await fs.unlink(tokenFile) } catch {}
    try { await fs.unlink(loginFile) } catch {}
  },

  async isLoggedIn(): Promise<boolean> {
    const token = await GitHub.getToken()
    return !!token && token.length >= 10
  },

  async getStoredUser(): Promise<GitHubUser | null> {
    const [token, login] = await Promise.all([GitHub.getToken(), GitHub.getLogin()])
    if (!token || !login) return null
    return { login, avatar_url: "", html_url: `https://github.com/${login}`, name: login, bio: null }
  },

  async getUser(): Promise<GitHubUser> {
    const token = await GitHub.getToken()
    if (!token) throw new Error("Not logged in")
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}`, "User-Agent": "anycode" },
    })
    if (res.status === 401) {
      await GitHub.removeToken()
      throw new Error("Token expired")
    }
    if (!res.ok) {
      const stored = await GitHub.getStoredUser()
      if (stored) return stored
      throw new Error("GitHub auth failed")
    }
    const user = await res.json()
    await GitHub.setLogin(user.login)
    return user
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
        await GitHub.setLogin(result.user.login)
        return { login: result.user.login, avatar_url: result.user.avatar_url, html_url: `https://github.com/${result.user.login}`, name: result.user.name, bio: null }
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
    try {
      const result = await collabApi("/collab/requests")
      return Array.isArray(result) ? result : []
    } catch { return [] }
  },

  async respondRequest(id: string, action: "accepted" | "declined"): Promise<CollabRequest> {
    return collabApi("/collab/respond", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    })
  },

  async cancelRequest(id: string): Promise<CollabRequest> {
    return collabApi("/collab/cancel", {
      method: "POST",
      body: JSON.stringify({ id }),
    })
  },

  async getCollabRepos(): Promise<any[]> {
    try {
      const result = await collabApi("/collab/repos")
      return Array.isArray(result) ? result : []
    } catch { return [] }
  },

  async deleteRepo(repo: string): Promise<any> {
    return collabApi("/collab/repo", {
      method: "DELETE",
      body: JSON.stringify({ repo }),
    })
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
