import { createSignal, For, Show, onMount, onCleanup, createEffect } from "solid-js"
import { useRoute } from "@tui/context/route"
import { useTheme } from "@tui/context/theme"
import { useToast } from "@tui/ui/toast"
import { Collab, GitHub } from "@/collab"
import { TextareaRenderable, BoxRenderable, TextRenderable, t, fg, bg, dim } from "@opentui/core"
import { useRenderer, useKeyboard, type JSX } from "@opentui/solid"
import { SplitBorder } from "@tui/component/border"
import { useLocal } from "@tui/context/local"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { useDialog } from "@tui/ui/dialog"

export function CollabProject() {
  const route = useRoute()
  const { theme } = useTheme()
  const toast = useToast()
  const dialog = useDialog()
  const local = useLocal()
  const project = route.data as any

  const repo = project.repo
  const repoName = project.repoName ?? repo?.split("/")?.[1] ?? "project"
  const members = project.members ?? []

  const [tab, setTab] = createSignal<"team" | "ai" | "aiai">("team")
  const [messages, setMessages] = createSignal<any[]>([])
  const [tasks, setTasks] = createSignal<any[]>([])
  const [login, setLogin] = createSignal<string>("")
  const [inputValue, setInputValue] = createSignal("")
  const [sending, setSending] = createSignal(false)

  let textarea: TextareaRenderable | undefined
  let scrollRef: any

  const refresh = async () => {
    try {
      const [msgs, t2] = await Promise.all([
        Collab.getChat(repo),
        Collab.getAiRequests(repo).catch(() => []),
      ])
      setMessages(msgs)
      setTasks(Array.isArray(t2) ? t2 : [])
    } catch {}
  }

  onMount(async () => {
    const l = await GitHub.getLogin()
    setLogin(l ?? "user")
    await refresh()
    const id = setInterval(refresh, 5000)
    onCleanup(() => clearInterval(id))
  })

  const sendMessage = async (type: "human" | "ai") => {
    const val = inputValue().trim()
    if (!val) return
    setSending(true)
    try {
      await Collab.sendChat(repo, login(), val, type)
      setInputValue("")
      if (textarea) { textarea.clear(); setInputValue("") }
      await refresh()
      setTimeout(() => {
        scrollRef?.scrollTo?.("bottom")
      }, 100)
    } catch {
      toast.show({ message: "Send failed", variant: "error" })
    }
    setSending(false)
  }

  const sendAiTask = async () => {
    const result = await DialogPrompt.show(dialog, "AI Task", { placeholder: "Task for other AI..." })
    if (!result) return
    try {
      await Collab.sendAiRequest(repo, login(), result)
      toast.show({ message: "Task sent!", variant: "success" })
      await refresh()
    } catch {
      toast.show({ message: "Failed", variant: "error" })
    }
  }

  const loginLower = login().toLowerCase()
  const activeTab = tab()
  const msgs = messages()
  const teamMsgs = msgs.filter((m: any) => m.type === "human")
  const aiMsgs = msgs.filter((m: any) => m.type === "ai")
  const allTasks = tasks()

  const tabLabel = () => {
    if (tab() === "team") return "Team Chat"
    if (tab() === "ai") return "AI Chat"
    return "AI-to-AI"
  }

  const tabColor = () => {
    if (tab() === "team") return theme.success
    if (tab() === "ai") return theme.accent
    return theme.warning
  }

  return (
    <box flexDirection="row" height="100%">
      <box width={1} backgroundColor={theme.border} />

      <box flexDirection="column" flexGrow={1} paddingBottom={0}>
        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={0} gap={2} backgroundColor={theme.backgroundPanel}>
          <text fg={theme.text}><b>{repoName.length > 30 ? repoName.slice(0, 28) + ".." : repoName}</b></text>
          <text fg={tabColor()}><b>{tabLabel()}</b></text>
          <text fg={activeTab === "team" ? theme.success : theme.textMuted} onMouseUp={() => setTab("team")}><b>Team</b></text>
          <text fg={activeTab === "ai" ? theme.accent : theme.textMuted} onMouseUp={() => setTab("ai")}><b>AI</b></text>
          <text fg={activeTab === "aiai" ? theme.warning : theme.textMuted} onMouseUp={() => setTab("aiai")}><b>AI-AI</b></text>
          <text fg={theme.textMuted} onMouseUp={() => route.navigate({ type: "home" })}><b>[Leave]</b></text>
          <text fg={theme.primary} onMouseUp={() => { try { Bun.spawn(["cmd", "/c", "start", `https://github.com/${repo}`]) } catch {} }}><b>[GitHub]</b></text>
        </box>

        <scrollbox ref={(r: any) => { scrollRef = r }} flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1} stickyStart="bottom">
          <Show when={activeTab === "team"}>
            <Show when={teamMsgs.length === 0}>
              <text fg={theme.textMuted}>No team messages yet. Type below to chat!</text>
            </Show>
            <For each={teamMsgs}>
              {(msg: any) => {
                const isMine = msg.from?.toLowerCase() === loginLower
                const color = isMine ? theme.success : theme.primary
                const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                return (
                  <box border={["left"]} borderColor={color} customBorderChars={SplitBorder.customBorderChars} marginTop={1} flexShrink={0}>
                    <box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor={theme.backgroundPanel} flexShrink={0}>
                      <box flexDirection="row" gap={1}>
                        <text fg={color}><b>{msg.from}</b></text>
                        <text fg={theme.textMuted}>{time}</text>
                      </box>
                      <text fg={theme.text}>{msg.body}</text>
                    </box>
                  </box>
                )
              }}
            </For>
          </Show>

          <Show when={activeTab === "ai"}>
            <Show when={aiMsgs.length === 0}>
              <text fg={theme.textMuted}>No AI messages yet.</text>
            </Show>
            <For each={aiMsgs}>
              {(msg: any) => {
                const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                return (
                  <box border={["left"]} borderColor={theme.accent} customBorderChars={SplitBorder.customBorderChars} marginTop={1} flexShrink={0}>
                    <box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor={theme.backgroundPanel} flexShrink={0}>
                      <box flexDirection="row" gap={1}>
                        <text fg={theme.accent}><b>AI</b></text>
                        <text fg={theme.textMuted}>{time}</text>
                      </box>
                      <text fg={theme.text}>{msg.body}</text>
                    </box>
                  </box>
                )
              }}
            </For>
          </Show>

          <Show when={activeTab === "aiai"}>
            <text fg={theme.warning}><b>AI Task Board</b></text>
            <Show when={allTasks.length === 0}>
              <text fg={theme.textMuted}>No tasks yet</text>
            </Show>
            <For each={allTasks}>
              {(task: any) => (
                <box border={["left"]} borderColor={task.status === "pending" ? theme.warning : theme.success} customBorderChars={SplitBorder.customBorderChars} marginTop={1} flexShrink={0}>
                  <box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor={theme.backgroundPanel} flexShrink={0}>
                    <box flexDirection="row" gap={1}>
                      <text fg={task.status === "pending" ? theme.warning : theme.success}><b>{task.status}</b></text>
                      <text fg={theme.textMuted}>{"@"}{task.fromUser}</text>
                    </box>
                    <text fg={theme.text}>{task.task}</text>
                  </box>
                </box>
              )}
            </For>
          </Show>
        </scrollbox>

        <box flexShrink={0} paddingLeft={2} paddingRight={2} paddingTop={0} paddingBottom={1} flexDirection="column">
          <Show when={activeTab === "aiai"}>
            <box flexDirection="row" gap={1} paddingTop={1}>
              <text fg={theme.warning} onMouseUp={sendAiTask}><b>⚡ New AI task...</b></text>
              <text fg={theme.textMuted} onMouseUp={refresh}><b>↻</b></text>
            </box>
          </Show>
          <Show when={activeTab !== "aiai"}>
            <textarea
              ref={(r: any) => { textarea = r }}
              minHeight={1}
              maxHeight={6}
              placeholder={activeTab === "team" ? "Type a message... (Enter to send)" : "Ask AI... (Enter to send)"}
              placeholderColor={theme.textMuted}
              textColor={theme.text}
              focusedTextColor={theme.text}
              onContentChange={() => {
                if (textarea) setInputValue(textarea.plainText)
              }}
              onKeyDown={(e: any) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(activeTab === "ai" ? "ai" : "human")
                }
              }}
              backgroundColor={theme.backgroundElement}
            />
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>{"@"}{login()}</text>
              <Show when={sending()}>
                <text fg={theme.textMuted}>Sending...</text>
              </Show>
              <text fg={theme.textMuted} onMouseUp={refresh}><b>↻</b></text>
            </box>
          </Show>
        </box>
      </box>

      <box width={24} backgroundColor={theme.backgroundPanel} paddingTop={1} paddingBottom={1} paddingLeft={1} paddingRight={1} flexDirection="column">
        <text fg={theme.text}><b>Members</b></text>
        <For each={members}>
          {(m: string) => {
            const isMe = m.toLowerCase() === loginLower
            return (
              <box flexDirection="row" gap={1}>
                <text fg={isMe ? theme.success : theme.primary}>●</text>
                <text fg={isMe ? theme.success : theme.text}>{"@"}{m}</text>
                <Show when={isMe}>
                  <text fg={theme.textMuted}>(you)</text>
                </Show>
              </box>
            )
          }}
        </For>
        <text fg={theme.textMuted}> </text>
        <text fg={theme.text}><b>Project</b></text>
        <text fg={theme.textMuted}>{repoName}</text>
        <text fg={theme.primary} onMouseUp={() => { try { Bun.spawn(["cmd", "/c", "start", `https://github.com/${repo}`]) } catch {} }}><b>Open on GitHub</b></text>
        <text fg={theme.textMuted}> </text>
        <text fg={theme.error} onMouseUp={() => route.navigate({ type: "home" })}><b>Leave project</b></text>
      </box>
    </box>
  )
}
