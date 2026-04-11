import z from "zod"
import { Memory } from "@/memory"
import { Tool } from "./tool"

export const MemoryTool = Tool.define("memory", {
  description:
    "Save, recall, list, or remove memories about the user. Use 'save' to store a key-value pair (e.g. user preferences, project info, personal details). Use 'recall' to retrieve a specific memory. Use 'list' to see all stored memories. Use 'remove' to delete a memory. Memories persist across all conversations.",
  parameters: z.object({
    action: z.enum(["save", "recall", "list", "remove"]).describe("The memory operation to perform"),
    key: z.string().optional().describe("The memory key (required for save, recall, remove)"),
    value: z.string().optional().describe("The value to store (required for save)"),
  }),
  async execute(args, _ctx) {
    switch (args.action) {
      case "save": {
        if (!args.key || !args.value) return { title: "Memory save", metadata: {}, output: "Error: key and value are required for save" }
        const result = Memory.save(args.key, args.value)
        return { title: `Saved: ${args.key}`, metadata: {}, output: result }
      }
      case "recall": {
        if (!args.key) return { title: "Memory recall", metadata: {}, output: "Error: key is required for recall" }
        const result = Memory.recall(args.key)
        return { title: `Recalled: ${args.key}`, metadata: {}, output: result }
      }
      case "remove": {
        if (!args.key) return { title: "Memory remove", metadata: {}, output: "Error: key is required for remove" }
        const result = Memory.remove(args.key)
        return { title: `Removed: ${args.key}`, metadata: {}, output: result }
      }
      case "list": {
        const result = Memory.all()
        return { title: "All memories", metadata: {}, output: result }
      }
    }
  },
})
