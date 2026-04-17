import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./open.txt"
import { Instance } from "@/project/instance"
import { Log } from "@/util/log"

const log = Log.create({ service: "open-tool" })

const parameters = z.object({
  target: z.string().describe("URL, file path, or program name to open"),
  app: z.string().optional().describe("Specific application to use (e.g. 'chrome', 'firefox', 'code')"),
  args: z.string().optional().describe("Additional arguments for the application"),
})

export const OpenTool = Tool.define("open", {
  description: DESCRIPTION,
  parameters,
  async execute(params, ctx) {
    await ctx.ask({
      permission: "open",
      patterns: [params.target],
      always: ["*"],
      metadata: { target: params.target, app: params.app },
    })

    const target = params.target
    const app = params.app
    const extraArgs = params.args || ""

    let command: string
    if (process.platform === "win32") {
      if (app) {
        command = extraArgs
          ? `start "" "${app}" ${extraArgs} "${target}"`
          : `start "" "${app}" "${target}"`
      } else {
        command = extraArgs
          ? `start "" ${extraArgs} "${target}"`
          : `start "" "${target}"`
      }
    } else if (process.platform === "darwin") {
      if (app) {
        command = extraArgs
          ? `open -a "${app}" ${extraArgs} "${target}"`
          : `open -a "${app}" "${target}"`
      } else {
        command = extraArgs
          ? `open ${extraArgs} "${target}"`
          : `open "${target}"`
      }
    } else {
      if (app) {
        command = extraArgs
          ? `${app} ${extraArgs} "${target}" &`
          : `${app} "${target}" &`
      } else {
        command = extraArgs
          ? `xdg-open ${extraArgs} "${target}" &`
          : `xdg-open "${target}" &`
      }
    }

    log.info("opening", { target, app, command })

    try {
      const shell = process.platform === "win32" ? "cmd" : "/bin/sh"
      const shellFlag = process.platform === "win32" ? "/c" : "-c"
      const proc = Bun.spawn([shell, shellFlag, command], {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
        cwd: Instance.directory,
      })
      proc.unref()
      return {
        title: `Opened: ${target}`,
        metadata: { target, app },
        output: `Launched: ${target}${app ? ` with ${app}` : ""}`,
      }
    } catch (e: any) {
      return {
        title: `Failed to open: ${target}`,
        metadata: { target, app, error: e.message },
        output: `Failed to open: ${e.message}`,
      }
    }
  },
})
