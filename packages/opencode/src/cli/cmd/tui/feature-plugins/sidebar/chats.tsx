import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createMemo, For, Show, createSignal } from "solid-js"

const id = "internal:sidebar-chats"

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const [open, setOpen] = createSignal(true)

  const sessions = createMemo(() => {
    const all = props.api.state.session.list()
    return all
      .filter((s) => !s.parentID)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
  })

  const current = createMemo(() => props.session_id)

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
    if (id !== current()) {
      props.api.route.navigate("session", { sessionID: id })
    }
  }

  const del = (id: string) => {
    props.api.client.session.delete({ sessionID: id }).catch(() => {})
  }

  const rename = (id: string) => {
    const sess = sessions().find((s) => s.id === id)
    props.api.ui.dialog.replace(() =>
      props.api.ui.DialogPrompt({
        title: "Rename Chat",
        value: sess?.title ?? "",
        onConfirm(value) {
          props.api.client.session.update({ sessionID: id, title: value }).catch(() => {})
          props.api.ui.dialog.clear()
        },
        onCancel() {
          props.api.ui.dialog.clear()
        },
      }),
    )
  }

  const newChat = () => {
    props.api.route.navigate("home")
  }

  return (
    <box>
      <box flexDirection="row" gap={1} onMouseDown={() => setOpen((x) => !x)}>
        <text fg={theme().text}>
          <b>Chats</b>
        </text>
        <text fg={theme().textMuted}>{open() ? "▾" : "▸"}</text>
        <text fg={theme().textMuted} marginLeft="auto">
          {sessions().length}
        </text>
      </box>
      <Show when={open()}>
        <box gap={0}>
          <For each={sessions()}>
            {(s) => {
              const active = createMemo(() => s.id === current())
              const title = s.title || "New chat"
              const trunc = title.length > 18 ? title.slice(0, 16) + ".." : title
              return (
                <box flexDirection="row" gap={1}>
                  <text
                    fg={active() ? theme().success : theme().textMuted}
                    onMouseUp={() => switchTo(s.id)}
                  >
                    {active() ? "●" : "○"}
                  </text>
                  <text
                    fg={active() ? theme().text : theme().textMuted}
                    onMouseUp={() => switchTo(s.id)}
                  >
                    {trunc}
                  </text>
                  <text fg={theme().textMuted}>{formatDate(s.updatedAt)}</text>
                  <Show when={!active()}>
                    <text
                      fg={theme().textMuted}
                      onMouseUp={() => del(s.id)}
                    >
                      ×
                    </text>
                  </Show>
                  <Show when={active()}>
                    <text
                      fg={theme().textMuted}
                      onMouseUp={() => rename(s.id)}
                    >
                      ✎
                    </text>
                  </Show>
                </box>
              )
            }}
          </For>
        </box>
        <Show when={sessions().length === 0}>
          <text fg={theme().textMuted}>No chats yet</text>
        </Show>
        <box flexDirection="row" gap={1}>
          <text fg={theme().primary} onMouseUp={newChat}>
            <b>+ New</b>
          </text>
          <text fg={theme().textMuted}>·</text>
          <text fg={theme().textMuted}>click ○ switch · ✎ rename · × del</text>
        </box>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 50,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
