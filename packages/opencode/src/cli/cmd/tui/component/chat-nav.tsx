import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { useTheme } from "@tui/context/theme"
import { useSDK } from "@tui/context/sdk"
import { useDialog } from "@tui/ui/dialog"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { createMemo, For, Show, createSignal } from "solid-js"
import { Locale } from "@/util/locale"
import { Clipboard } from "@tui/util/clipboard"
import { Global } from "@/global"
import path from "path"

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

  const rename = (id: string) => {
    const sess = sync.session.get(id)
    DialogPrompt.show(dialog, "Rename Chat", {
      value: sess?.title ?? "",
      onConfirm(value) {
        sdk.client.session.update({ sessionID: id, title: value }).catch(() => {})
      },
    })
  }

  const openSettings = () => {
    const configPath = path.join(Global.Path.config, "tui.json")
    Clipboard.copy(configPath).then(() => {
      dialog.replace(() => (
        <box gap={1} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg={theme.text}><b>Settings</b></text>
          <text fg={theme.textMuted}>Config path copied to clipboard:</text>
          <text fg={theme.primary}>{configPath}</text>
          <text fg={theme.textMuted}>Edit tui.json to change keybinds & theme</text>
          <text fg={theme.textMuted}>Edit opencode.json for providers & agents</text>
          <text fg={theme.textMuted}>Press Esc to close</text>
        </box>
      ))
    })
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
