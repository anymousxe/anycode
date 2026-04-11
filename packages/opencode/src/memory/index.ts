import path from "path"
import fs from "fs"
import { Global } from "@/global"
import { Log } from "@/util/log"

const log = Log.create({ service: "memory" })

export type MemoryEntry = {
  key: string
  value: string
  createdAt: number
}

const MEMORY_FILE = () => path.join(Global.Path.config, "memory.json")

function read(): MemoryEntry[] {
  try {
    const data = fs.readFileSync(MEMORY_FILE(), "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

function write(entries: MemoryEntry[]) {
  const dir = path.dirname(MEMORY_FILE())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(MEMORY_FILE(), JSON.stringify(entries, null, 2))
}

export namespace Memory {
  export function save(key: string, value: string): string {
    const entries = read()
    const existing = entries.findIndex((e) => e.key === key)
    const entry: MemoryEntry = { key, value, createdAt: Date.now() }
    if (existing >= 0) {
      entries[existing] = entry
    } else {
      entries.push(entry)
    }
    write(entries)
    log.info("saved memory", { key })
    return `Saved: ${key}`
  }

  export function recall(key: string): string {
    const entries = read()
    const entry = entries.find((e) => e.key === key)
    if (!entry) return `No memory found for key: ${key}`
    return entry.value
  }

  export function list(): MemoryEntry[] {
    return read()
  }

  export function remove(key: string): string {
    const entries = read()
    const filtered = entries.filter((e) => e.key !== key)
    if (filtered.length === entries.length) return `No memory found for key: ${key}`
    write(filtered)
    return `Removed: ${key}`
  }

  export function all(): string {
    const entries = read()
    if (entries.length === 0) return "No memories stored yet."
    return entries.map((e) => `[${e.key}]: ${e.value}`).join("\n")
  }

  export function systemPrompt(): string {
    const entries = read()
    if (entries.length === 0) return ""
    const lines = entries.map((e) => `- ${e.key}: ${e.value}`)
    return [
      "<user_memory>",
      "The following are things you remember about this user. Use this context to personalize your responses:",
      ...lines,
      "</user_memory>",
    ].join("\n")
  }
}
