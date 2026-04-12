import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { useTheme } from "@tui/context/theme"
import { useSDK } from "@tui/context/sdk"
import { useDialog } from "@tui/ui/dialog"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { DialogAlert } from "@tui/ui/dialog-alert"
import { useToast } from "@tui/ui/toast"
import { createMemo, For, Show, createSignal } from "solid-js"
import { Locale } from "@/util/locale"
import { Memory } from "@/memory"
import { Global } from "@/global"
import { Installation } from "@/installation"
import { useLocal } from "@tui/context/local"
import { GitHub } from "@/collab"

interface GitHubProfile {
  login: string
  avatar_url: string
  name: string | null
  bio: string | null
}

export function ChatNav() {
  const sync = useSync()
  const route = useRoute()
  const { theme } = useTheme()
  const sdk = useSDK()
  const dialog = useDialog()
  const [collapsed, setCollapsed] = createSignal(false)

  const currentSession = createMemo(() =>
    route.data.type === "session" ? route.data.sessionID : undefined,
  )

  const sessions = createMemo(() =>
    sync.data.session
      .filter((s) => !s.parentID)
      .toSorted((a, b) => b.time.updated - a.time.updated)
      .slice(0, 25),
  )

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sess = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diff = Math.floor((today.getTime() - sess.getTime()) / 86400000)
    if (diff === 0) return "Today"
    if (diff === 1) return "Yest"
    if (diff < 7) return `${diff}d`
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const switchTo = (id: string) => {
    route.navigate({ type: "session", sessionID: id })
  }

  const goHome = () => {
    route.navigate({ type: "home" })
  }

  const del = async (id: string) => {
    await sdk.client.session.delete({ sessionID: id }).catch(() => {})
  }

  const rename = async (id: string) => {
    const sess = sync.session.get(id)
    const result = await DialogPrompt.show(dialog, "Rename Chat", {
      value: sess?.title ?? "",
    })
    if (result !== null) {
      sdk.client.session.update({ sessionID: id, title: result }).catch(() => {})
    }
  }

  const local = useLocal()
  const toast = useToast()

  const [updateStatus, setUpdateStatus] = createSignal<"idle" | "checking" | "up-to-date" | "available" | "downloading">("idle")
  const [latestVersion, setLatestVersion] = createSignal("")
  const [ghProfile, setGhProfile] = createSignal<GitHubProfile | null>(null)
  const [ghLoading, setGhLoading] = createSignal(false)

  const loadGitHub = async () => {
    setGhLoading(true)
    try {
      if (!(await GitHub.isLoggedIn())) {
        const user = await GitHub.login()
        setGhProfile(user)
      } else {
        const user = await GitHub.getUser()
        setGhProfile(user)
      }
    } catch {
      setGhProfile(null)
    }
    setGhLoading(false)
  }

  const checkForUpdates = async () => {
    setUpdateStatus("checking")
    try {
      const method = await Installation.method()
      const latest = await Installation.latest(method)
      if (Installation.VERSION === latest) {
        setUpdateStatus("up-to-date")
      } else {
        setUpdateStatus("available")
        setLatestVersion(latest)
      }
    } catch {
      toast.show({ variant: "error", message: "Failed to check for updates", duration: 3000 })
      setUpdateStatus("idle")
    }
  }

  const doUpdate = async (target: string) => {
    setUpdateStatus("downloading" as any)
    try {
      const ext = process.platform === "win32" ? ".exe" : ""
      const url = `https://github.com/anymousxe/anycode/releases/download/v${target}/anycode${ext}`
      const res = await fetch(url, { redirect: "follow" })
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const stagingPath = process.execPath + ".new"
      const fs = await import("fs/promises")
      await fs.writeFile(stagingPath, buf, { mode: 0o755 })
      await fs.writeFile(stagingPath + ".ver", target)
      await DialogAlert.show(dialog, "Update Ready", `AnyCode v${target} downloaded. Restart anycode to apply the update.`)
      setUpdateStatus("idle")
    } catch {
      toast.show({ variant: "error", message: "Download failed", duration: 5000 })
      setUpdateStatus("available")
    }
  }

  const openSettings = () => {
    const allModes = ["build", "plan", "agent", "coding"]
    const modeColors: Record<string, string> = {
      build: theme.primary.toString(),
      plan: theme.accent.toString(),
      agent: theme.success.toString(),
      coding: theme.warning.toString(),
    }
    dialog.replace(() => (
      <box gap={1} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
        <text fg={theme.text}><b>⚙ Settings</b></text>
        <text fg={theme.textMuted}> </text>
        <text fg={theme.text}><b>Tab Modes</b></text>
        <For each={allModes}>
          {(name) => {
            const active = createMemo(() => !local.agent.hiddenModes().includes(name))
            return (
              <box flexDirection="row" gap={1}>
                <text
                  fg={active() ? theme.success : theme.textMuted}
                  onMouseUp={() => local.agent.toggleMode(name)}
                >
                  {active() ? "●" : "○"}
                </text>
                <text fg={modeColors[name] ?? theme.text}>{name}</text>
                <text fg={theme.textMuted}>{active() ? "shown" : "hidden"}</text>
              </box>
            )
          }}
        </For>
        <text fg={theme.textMuted}>Click ●/○ to toggle, at least one must stay on</text>
        <text fg={theme.textMuted}> </text>
        <text fg={theme.text}><b>Updates</b></text>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text}>Current: v{Installation.VERSION}</text>
        </box>
        <Show when={updateStatus() === "idle"}>
          <text fg={theme.primary} onMouseUp={checkForUpdates}><b>↻ Check for Updates</b></text>
        </Show>
        <Show when={updateStatus() === "checking"}>
          <text fg={theme.textMuted}>Checking...</text>
        </Show>
        <Show when={updateStatus() === "up-to-date"}>
          <text fg={theme.success}>✓ Up to date!</text>
        </Show>
        <Show when={updateStatus() === "available"}>
          <box flexDirection="row" gap={1}>
            <text fg={theme.warning}>↑ v{latestVersion()} available</text>
            <text fg={theme.primary} onMouseUp={() => doUpdate(latestVersion())}><b>[Update Now]</b></text>
          </box>
        </Show>
        <Show when={updateStatus() === "downloading"}>
          <text fg={theme.textMuted}>Downloading...</text>
        </Show>
        <text fg={theme.textMuted}> </text>
        <text fg={theme.text}><b>GitHub</b></text>
        <Show when={!ghProfile() && !ghLoading()}>
          <text fg={theme.primary} onMouseUp={loadGitHub}><b>↻ Connect GitHub</b></text>
        </Show>
        <Show when={ghLoading()}>
          <text fg={theme.textMuted}>Loading...</text>
        </Show>
        <Show when={ghProfile()}>
          {(p) => (
            <box flexDirection="row" gap={1}>
              <text fg={theme.success}>●</text>
              <text fg={theme.text}>{p().name ?? p().login}</text>
              <text fg={theme.textMuted}>@{p().login}</text>
            </box>
          )}
        </Show>
        <text fg={theme.textMuted}> </text>
        <text fg={theme.textMuted}>Config: ~/.config/anycode/tui.json</text>
        <text fg={theme.textMuted}>Press Esc to close</text>
      </box>
    ))
  }

  if (collapsed()) {
    return (
      <box
        width={3}
        height="100%"
        backgroundColor={theme.backgroundPanel}
        paddingTop={1}
        alignItems="center"
      >
        <text fg={theme.textMuted} onMouseDown={() => setCollapsed(false)}>
          ▸
        </text>
      </box>
    )
  }

  return (
    <box
      width={28}
      height="100%"
      backgroundColor={theme.backgroundPanel}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text fg={theme.text}>
          <b>Chats</b>
        </text>
        <text fg={theme.textMuted} onMouseDown={() => setCollapsed(true)}>
          ✕
        </text>
      </box>

      <text
        fg={theme.primary}
        paddingBottom={1}
        onMouseUp={goHome}
      >
        <b>+ New chat</b>
      </text>

       <scrollbox flexGrow={1}>
        <box gap={0}>
          <For each={sessions()}>
            {(s) => {
              const active = createMemo(() => s.id === currentSession())
              const title = s.title || "New chat"
              const trunc = title.length > 20 ? title.slice(0, 18) + ".." : title
              return (
                <box flexDirection="row" gap={1} paddingBottom={0}>
                  <text
                    fg={active() ? theme.success : theme.textMuted}
                    onMouseUp={() => switchTo(s.id)}
                  >
                    {active() ? "●" : "○"}
                  </text>
                  <text
                    fg={active() ? theme.text : theme.textMuted}
                    onMouseUp={() => switchTo(s.id)}
                    flexGrow={1}
                  >
                    {trunc}
                  </text>
                  <Show when={active()}>
                    <text fg={theme.textMuted} onMouseUp={() => rename(s.id)}>
                      ✎
                    </text>
                  </Show>
                  <Show when={!active()}>
                    <text fg={theme.textMuted} onMouseUp={() => del(s.id)}>
                      ×
                    </text>
                  </Show>
                </box>
              )
            }}
          </For>
          <Show when={sessions().length === 0}>
            <text fg={theme.textMuted}>No chats yet</text>
          </Show>
        </box>
      </scrollbox>

      <text fg={theme.border}>──────────────────────</text>
      <text
        fg={theme.textMuted}
        onMouseUp={openSettings}
      >
        ⚙ Settings
      </text>
    </box>
  )
}
