import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./clipboard.txt"
import { Log } from "@/util/log"

const log = Log.create({ service: "clipboard-tool" })

const parameters = z.object({
  action: z.enum(["read", "write", "append"]).describe("Clipboard action: read, write, or append"),
  text: z.string().optional().describe("Text to write/append to clipboard"),
})

async function clipboardRead(): Promise<string> {
  const platform = process.platform
  if (platform === "win32") {
    const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", "Get-Clipboard"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const text = await new Response(proc.stdout).text()
    return text.trim()
  } else if (platform === "darwin") {
    const proc = Bun.spawn(["pbpaste"], { stdout: "pipe", stderr: "pipe" })
    const text = await new Response(proc.stdout).text()
    return text
  } else {
    const proc = Bun.spawn(["xclip", "-selection", "clipboard", "-o"], { stdout: "pipe", stderr: "pipe" })
    const text = await new Response(proc.stdout).text()
    return text
  }
}

async function clipboardWrite(text: string): Promise<void> {
  const platform = process.platform
  if (platform === "win32") {
    const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", `Set-Clipboard -Value ${JSON.stringify(text)}`], {
      stdout: "pipe",
      stderr: "pipe",
    })
    await proc.exited
  } else if (platform === "darwin") {
    const proc = Bun.spawn(["pbcopy"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" })
    proc.stdin.write(text)
    proc.stdin.end()
    await proc.exited
  } else {
    const proc = Bun.spawn(["xclip", "-selection", "clipboard"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" })
    proc.stdin.write(text)
    proc.stdin.end()
    await proc.exited
  }
}

export const ClipboardTool = Tool.define("clipboard", {
  description: DESCRIPTION,
  parameters,
  async execute(params, ctx): Promise<{ title: string; metadata: { [key: string]: any }; output: string }> {
    const action = params.action

    if (action === "read") {
      try {
        const text = await clipboardRead()
        return {
          title: "Clipboard read",
          metadata: { length: text.length },
          output: text || "(clipboard is empty)",
        }
      } catch (e: any) {
        return {
          title: "Failed to read clipboard",
          metadata: {},
          output: `Failed to read clipboard: ${e.message}`,
        }
      }
    }

    if (action === "write") {
      if (!params.text && params.text !== "") return { title: "Error", metadata: {}, output: "Must provide 'text' to write." }
      try {
        await clipboardWrite(params.text)
        return {
          title: "Copied to clipboard",
          metadata: { length: params.text.length },
          output: `Copied ${params.text.length} chars to clipboard: ${params.text.substring(0, 200)}${params.text.length > 200 ? "..." : ""}`,
        }
      } catch (e: any) {
        return {
          title: "Failed to write clipboard",
          metadata: {},
          output: `Failed to write clipboard: ${e.message}`,
        }
      }
    }

    if (action === "append") {
      if (!params.text) return { title: "Error", metadata: {}, output: "Must provide 'text' to append." }
      try {
        const existing = await clipboardRead()
        await clipboardWrite(existing + params.text)
        return {
          title: "Appended to clipboard",
          metadata: {},
          output: `Appended ${params.text.length} chars to clipboard.`,
        }
      } catch (e: any) {
        return {
          title: "Failed to append to clipboard",
          metadata: {},
          output: `Failed: ${e.message}`,
        }
      }
    }

    return { title: "Error", metadata: {}, output: `Unknown action: ${action}` }
  },
})
