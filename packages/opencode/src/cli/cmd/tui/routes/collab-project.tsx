import { createSignal, For, Show, onMount, onCleanup } from "solid-js"
import { useRoute } from "@tui/context/route"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { Collab, GitHub } from "@/collab"

export function CollabProject() {
  const route = useRoute()
  const { theme } = useTheme()
  const dialog = useDialog()
  const toast = useToast()
  const project = route.data as any

  const [tab, setTab] = createSignal<"team" | "ai" | "aiai">("team")
  const [messages, setMessages] = createSignal<any[]>([])
  const [tasks, setTasks] = createSignal<any[]>([])
  const [login, setLogin] = createSignal<string>("")
  const [pollTimer, setPollTimer] = createSignal<any>(null)

  const repo = project.repo
  const repoName = project.repoName ?? repo?.split("/")?.[1] ?? repo
  const members = project.members ?? []

  const refresh = async () => {
    try {
      const [msgs, t] = await Promise.all([
        Collab.getChat(repo),
        Collab.getAiRequests(repo).catch(() => []),
      ])
      setMessages(msgs)
      setTasks(Array.isArray(t) ? t : [])
    } catch {}
  }

  onMount(async () => {
    const l = await GitHub.getLogin()
    setLogin(l ?? "user")
    await refresh()
    const id = setInterval(refresh, 5000)
    setPollTimer(id)
  })

  onCleanup(() => {
    if (pollTimer()) clearInterval(pollTimer())
  })

  const sendMessage = async (type: "human" | "ai") => {
    const label = type === "ai" ? "Ask AI..." : "Say something..."
    const result = await DialogPrompt.show(dialog, "Send", { placeholder: label })
    if (!result) return
    try {
      await Collab.sendChat(repo, login(), result, type)
      await refresh()
    } catch {
      toast.show({ message: "Failed", variant: "error" })
    }
  }

  const activeTab = tab()
  const msgs = messages()
  const allTasks = tasks()
  const loginLower = login().toLowerCase()
  const teamMsgs = msgs.filter((m: any) => m.type === "human")
  const aiMsgs = msgs.filter((m: any) => m.type === "ai")

  return (
    <box flexDirection="row" height="100%">
      <box width={24} backgroundColor={theme.backgroundPanel} paddingTop={1} paddingBottom={1} paddingLeft={1} paddingRight={1} flexDirection="column">
        <text fg={theme.text}><b>{repoName.length > 20 ? repoName.slice(0, 18) + ".." : repoName}</b></text>
        <text fg={theme.textMuted}>Members:</text>
        <For each={members}>
          {(m: string) => <text fg={theme.primary}>{"@"}{m}</text>}
        </For>
        <text fg={theme.textMuted}> </text>
        <text fg={theme.primary} onMouseUp={() => { try { Bun.spawn(["cmd", "/c", "start", `https://github.com/${repo}`]) } catch {} }}><b>[GitHub]</b></text>
        <text fg={theme.textMuted} onMouseUp={() => route.navigate({ type: "home" })}><b>[Leave]</b></text>
      </box>

      <box flexGrow={1} flexDirection="column" paddingBottom={1}>
        <box flexDirection="row" gap={2} paddingTop={1} paddingLeft={2} paddingRight={2}>
          <text fg={activeTab === "team" ? theme.primary : theme.textMuted} onMouseUp={() => setTab("team")}><b>Team</b></text>
          <text fg={activeTab === "ai" ? theme.primary : theme.textMuted} onMouseUp={() => setTab("ai")}><b>AI</b></text>
          <text fg={activeTab === "aiai" ? theme.accent : theme.textMuted} onMouseUp={() => setTab("aiai")}><b>AI-AI</b></text>
        </box>

        <scrollbox flexGrow={1} paddingLeft={2} paddingRight={2}>
          <Show when={tab() === "team"}>
            <Show when={teamMsgs.length === 0}>
              <text fg={theme.textMuted}>No team messages yet</text>
            </Show>
            <For each={teamMsgs}>
              {(msg: any) => {
                const isMine = msg.from?.toLowerCase() === loginLower
                const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                return (
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.textMuted}>{time}</text>
                    <text fg={isMine ? theme.success : theme.primary}><b>{msg.from}</b></text>
                    <text fg={theme.text}>{msg.body}</text>
                  </box>
                )
              }}
            </For>
          </Show>

          <Show when={tab() === "ai"}>
            <Show when={aiMsgs.length === 0}>
              <text fg={theme.textMuted}>No AI messages yet</text>
            </Show>
            <For each={aiMsgs}>
              {(msg: any) => {
                const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                return (
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.textMuted}>{time}</text>
                    <text fg={theme.accent}><b>AI</b></text>
                    <text fg={theme.text}>{msg.body}</text>
                  </box>
                )
              }}
            </For>
          </Show>

          <Show when={tab() === "aiai"}>
            <text fg={theme.accent}><b>AI Task Board</b></text>
            <Show when={allTasks.length === 0}>
              <text fg={theme.textMuted}>No tasks yet</text>
            </Show>
            <For each={allTasks}>
              {(task: any) => (
                <box flexDirection="row" gap={1}>
                  <text fg={task.status === "pending" ? theme.warning : theme.success}>{task.status}</text>
                  <text fg={theme.textMuted}>{"@"}{task.fromUser}</text>
                  <text fg={theme.text}>{task.task}</text>
                </box>
              )}
            </For>
          </Show>
        </scrollbox>

        <box flexShrink={0} paddingLeft={2} paddingRight={2} gap={1}>
          <Show when={tab() === "team"}>
            <text fg={theme.primary} onMouseUp={() => sendMessage("human")}><b>➤ Type a message...</b></text>
          </Show>
          <Show when={tab() === "ai"}>
            <text fg={theme.primary} onMouseUp={() => sendMessage("ai")}><b>➤ Ask AI...</b></text>
          </Show>
          <Show when={tab() === "aiai"}>
            <text fg={theme.accent} onMouseUp={async () => {
              const result = await DialogPrompt.show(dialog, "AI Task", { placeholder: "Task for other AI..." })
              if (!result) return
              try {
                await Collab.sendAiRequest(repo, login(), result)
                toast.show({ message: "Task sent!", variant: "success" })
                await refresh()
              } catch {
                toast.show({ message: "Failed", variant: "error" })
              }
            }}><b>⚡ New task...</b></text>
          </Show>
          <text fg={theme.textMuted} onMouseUp={refresh}><b>↻</b></text>
        </box>
      </box>
    </box>
  )
}
