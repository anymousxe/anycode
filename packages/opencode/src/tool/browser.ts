import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./browser.txt"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import WebSocket from "ws"

const log = Log.create({ service: "browser-tool" })

type Meta = { [key: string]: any }

const parameters = z.object({
  action: z.enum([
    "launch",
    "navigate",
    "network.watch",
    "network.capture",
    "network.wait",
    "cookies",
    "evaluate",
    "screenshot",
    "click",
    "type",
    "close",
    "list",
  ]).describe("Browser action to perform"),
  browserId: z.string().optional().describe("Browser instance ID (from launch)"),
  url: z.string().optional().describe("URL for navigate/network.wait"),
  pattern: z.string().optional().describe("URL pattern to match for network.wait/capture (substring match)"),
  selector: z.string().optional().describe("CSS selector for click/type"),
  text: z.string().optional().describe("Text to type"),
  script: z.string().optional().describe("JavaScript to evaluate in page"),
  timeout: z.number().optional().describe("Timeout in seconds for network.wait (default: 120)"),
  headless: z.boolean().optional().describe("Run in headless mode (default: false — visible window)"),
})

type BrowserInstance = {
  id: string
  proc: ReturnType<typeof Bun.spawn>
  port: number
  ws: WebSocket | null
  pages: Map<string, WebSocket>
  networkLog: Array<{ url: string; method: string; status: number; headers: Record<string, string>; body?: string; requestId: string; resourceType: string; timestamp: string }>
  watching: boolean
  targetId: string
}

const browsers = new Map<string, BrowserInstance>()

function findChrome(): string {
  const platform = process.platform
  if (platform === "win32") {
    const paths = [
      process.env.CHROME_PATH,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
      process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      process.env.LOCALAPPDATA + "\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      process.env.LOCALAPPDATA + "\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter(Boolean)
    for (const p of paths) {
      try {
        require("fs").accessSync(p!)
        return p!
      } catch {}
    }
  } else if (platform === "darwin") {
    const paths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for (const p of paths) {
      try {
        require("fs").accessSync(p)
        return p
      } catch {}
    }
  } else {
    const paths = [
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/usr/bin/brave-browser",
      "/usr/bin/microsoft-edge",
      "/snap/bin/chromium",
    ]
    for (const p of paths) {
      try {
        require("fs").accessSync(p)
        return p
      } catch {}
    }
  }
  return platform === "win32" ? "chrome" : "google-chrome"
}

async function getDebugTargets(port: number): Promise<Array<{ id: string; webSocketDebuggerUrl: string; url: string; title: string; type?: string }>> {
  const res = await fetch(`http://127.0.0.1:${port}/json`)
  if (!res.ok) return []
  return await res.json() as any[]
}

let cdpId = 0
function cdpSend(ws: WebSocket, method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++cdpId
    const handler = (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.id === id) {
          ws.off("message", handler)
          if (msg.error) reject(new Error(msg.error.message))
          else resolve(msg.result)
        }
      } catch {}
    }
    ws.on("message", handler)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function connectToPage(browser: BrowserInstance): Promise<void> {
  const targets = await getDebugTargets(browser.port)
  const page = targets.find(t => t.type === "page" && !t.url.startsWith("devtools://"))
  if (!page || !page.webSocketDebuggerUrl) throw new Error("No page target found")

  browser.targetId = page.id

  if (browser.pages.has(page.id)) return

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve())
    ws.once("error", reject)
  })

  browser.pages.set(page.id, ws)

  ws.on("message", (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.method === "Network.requestWillBeSent" && browser.watching) {
        const req = msg.params
        browser.networkLog.push({
          url: req.request.url,
          method: req.request.method,
          status: 0,
          headers: req.request.headers,
          requestId: req.requestId,
          resourceType: req.type || "Other",
          timestamp: new Date().toISOString(),
        })
      }
      if (msg.method === "Network.responseReceived" && browser.watching) {
        const resp = msg.params
        const entry = browser.networkLog.find(e => e.requestId === resp.requestId)
        if (entry) {
          entry.status = resp.response.status
          entry.headers = { ...entry.headers, ...resp.response.headers }
        }
      }
      if (msg.method === "Network.loadingFinished" && browser.watching) {
        const finished = msg.params
        const entry = browser.networkLog.find(e => e.requestId === finished.requestId)
        if (entry && entry.status !== 0) {
          const pageWs = browser.pages.get(browser.targetId)
          if (pageWs && pageWs.readyState === WebSocket.OPEN) {
            cdpSend(pageWs, "Network.getResponseBody", { requestId: finished.requestId })
              .then((result: any) => {
                if (result?.body) {
                  entry.body = result.body.substring(0, 50000)
                }
              })
              .catch(() => {})
          }
        }
      }
    } catch {}
  })
}

export const BrowserTool = Tool.define("browser", {
  description: DESCRIPTION,
  parameters,
  async execute(params, ctx): Promise<{ title: string; metadata: Meta; output: string; attachments?: any[] }> {
    await ctx.ask({
      permission: "browser",
      patterns: [params.action],
      always: ["*"],
      metadata: { action: params.action },
    })

    const action = params.action

    if (action === "launch") {
      const id = `browser-${Date.now()}`
      const port = 9200 + Math.floor(Math.random() * 100)
      const chromePath = findChrome()
      const headless = params.headless ?? false

      const args = [
        `--remote-debugging-port=${port}`,
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${require("os").tmpdir()}/anycode-browser-${id}`,
        headless ? "--headless=new" : "",
        headless ? "--disable-gpu" : "",
        "--disable-background-networking",
        "--disable-sync",
        "--no-prompt-on-reopen",
      ].filter(Boolean)

      log.info("launching browser", { chromePath, port, headless })

      try {
        const proc = Bun.spawn([chromePath, ...args], {
          detached: true,
          stdio: ["ignore", "ignore", "ignore"],
          cwd: Instance.directory,
        })
        proc.unref()

        await new Promise(r => setTimeout(r, 2000))

        const browser: BrowserInstance = {
          id,
          proc,
          port,
          ws: null,
          pages: new Map(),
          networkLog: [],
          watching: false,
          targetId: "",
        }
        browsers.set(id, browser)

        await connectToPage(browser)

        const pageWs = browser.pages.get(browser.targetId)
        if (pageWs) {
          await cdpSend(pageWs, "Network.enable")
          browser.watching = true
        }

        return {
          title: `Browser launched on port ${port}`,
          metadata: { browserId: id, port },
          output: `Browser launched.\n\nBrowser ID: ${id}\nDebug port: ${port}\nChrome: ${chromePath}\nHeadless: ${headless}\n\nNetwork monitoring is active. Use navigate to go to a URL, then network.wait to watch for specific requests.`,
        }
      } catch (e: any) {
        return {
          title: "Failed to launch browser",
          metadata: { error: e.message },
          output: `Failed to launch browser: ${e.message}\n\nMake sure Chrome, Edge, or Brave is installed.`,
        }
      }
    }

    if (action === "navigate") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found. Launch one first with action: launch." }

      await connectToPage(browser)
      const pageWs = browser.pages.get(browser.targetId)
      if (!pageWs) return { title: "Error", metadata: {}, output: "No page connected." }

      try {
        await cdpSend(pageWs, "Page.navigate", { url: params.url })
        return {
          title: `Navigated to ${params.url}`,
          metadata: { url: params.url },
          output: `Navigated to ${params.url}\n\nNetwork monitoring is active. Use network.capture to see requests, or network.wait to watch for a specific request.`,
        }
      } catch (e: any) {
        return { title: "Navigate failed", metadata: {}, output: `Failed to navigate: ${e.message}` }
      }
    }

    if (action === "network.watch") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      browser.watching = true
      const pageWs = browser.pages.get(browser.targetId)
      if (pageWs && pageWs.readyState === WebSocket.OPEN) {
        await cdpSend(pageWs, "Network.enable")
      }

      return {
        title: "Network monitoring active",
        metadata: { requestCount: browser.networkLog.length },
        output: `Network monitoring is active. ${browser.networkLog.length} requests captured so far.\n\nUse network.capture to see them, or network.wait to block until a specific request is seen.`,
      }
    }

    if (action === "network.capture") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      let entries = browser.networkLog
      if (params.pattern) {
        entries = entries.filter(e => e.url.includes(params.pattern!))
      }

      const summary = entries.slice(-100).map(e => {
        let line = `[${e.timestamp}] ${e.method} ${e.status} ${e.resourceType} ${e.url}`
        if (e.body) {
          const bodyPreview = e.body.substring(0, 2000)
          line += `\n  Body: ${bodyPreview}`
        }
        const authHeaders = Object.entries(e.headers).filter(([k]) =>
          /auth|token|cookie|authorization|set-cookie|bearer/i.test(k)
        )
        if (authHeaders.length) {
          line += `\n  Auth headers: ${authHeaders.map(([k, v]) => `${k}: ${v}`).join(", ")}`
        }
        return line
      }).join("\n\n")

      return {
        title: `${entries.length} network requests captured`,
        metadata: { count: entries.length },
        output: entries.length === 0
          ? "No network requests captured yet. Navigate to a page first."
          : `Captured ${entries.length} requests${params.pattern ? ` matching "${params.pattern}"` : ""}:\n\n${summary}`,
      }
    }

    if (action === "network.wait") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      if (!params.pattern) return { title: "Error", metadata: {}, output: "Must provide a 'pattern' (URL substring) to wait for." }

      const timeoutMs = (params.timeout ?? 120) * 1000
      const startTime = Date.now()

      browser.watching = true
      const pageWs = browser.pages.get(browser.targetId)
      if (pageWs && pageWs.readyState === WebSocket.OPEN) {
        await cdpSend(pageWs, "Network.enable")
      }

      return new Promise((resolve) => {
        const check = () => {
          const match = browser.networkLog.find(e =>
            e.url.includes(params.pattern!) && e.status !== 0
          )
          if (match) {
            let output = `Found matching request!\n\nURL: ${match.url}\nMethod: ${match.method}\nStatus: ${match.status}\nType: ${match.resourceType}\nTimestamp: ${match.timestamp}`

            const authHeaders = Object.entries(match.headers).filter(([k]) =>
              /auth|token|cookie|authorization|bearer|set-cookie/i.test(k)
            )
            if (authHeaders.length) {
              output += `\n\nAuth-related headers:\n${authHeaders.map(([k, v]) => `  ${k}: ${v}`).join("\n")}`
            }

            if (match.body) {
              output += `\n\nResponse body (first 2000 chars):\n${match.body.substring(0, 2000)}`
            }

            resolve({
              title: `Captured: ${match.url}`,
              metadata: { url: match.url, status: match.status, method: match.method },
              output,
            })
            return
          }

          if (Date.now() - startTime > timeoutMs) {
            resolve({
              title: "Timeout waiting for request",
              metadata: { pattern: params.pattern },
              output: `Timed out after ${params.timeout ?? 120}s waiting for request matching "${params.pattern}".\n\nCaptured ${browser.networkLog.length} requests total. Use network.capture to see them.`,
            })
            return
          }

          setTimeout(check, 500)
        }
        check()
      })
    }

    if (action === "cookies") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      const pageWs = browser.pages.get(browser.targetId)
      if (!pageWs) return { title: "Error", metadata: {}, output: "No page connected." }

      try {
        const result = await cdpSend(pageWs, "Network.getCookies")
        const cookies = result.cookies || []
        const summary = cookies.map((c: any) =>
          `${c.name}=${c.value} (domain: ${c.domain}, path: ${c.path}${c.httpOnly ? ", httpOnly" : ""}${c.secure ? ", secure" : ""})`
        ).join("\n")

        return {
          title: `${cookies.length} cookies`,
          metadata: { count: cookies.length },
          output: cookies.length === 0
            ? "No cookies found."
            : `Cookies (${cookies.length}):\n${summary}`,
        }
      } catch (e: any) {
        return { title: "Error", metadata: {}, output: `Failed to get cookies: ${e.message}` }
      }
    }

    if (action === "evaluate") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      if (!params.script) return { title: "Error", metadata: {}, output: "Must provide 'script' to evaluate." }

      const pageWs = browser.pages.get(browser.targetId)
      if (!pageWs) return { title: "Error", metadata: {}, output: "No page connected." }

      try {
        const result = await cdpSend(pageWs, "Runtime.evaluate", {
          expression: params.script,
          returnByValue: true,
        })
        const output = result.exceptionMessage
          ? `Error: ${result.exceptionMessage}`
          : JSON.stringify(result.result?.value ?? result.result, null, 2)

        return {
          title: "JavaScript evaluated",
          metadata: {},
          output: output.substring(0, 10000),
        }
      } catch (e: any) {
        return { title: "Error", metadata: {}, output: `Failed to evaluate: ${e.message}` }
      }
    }

    if (action === "screenshot") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      const pageWs = browser.pages.get(browser.targetId)
      if (!pageWs) return { title: "Error", metadata: {}, output: "No page connected." }

      try {
        const result = await cdpSend(pageWs, "Page.captureScreenshot", { format: "png" })
        return {
          title: "Screenshot captured",
          metadata: {},
          output: `Screenshot captured (${result.data.length} bytes base64)`,
          attachments: [{
            type: "file" as const,
            mime: "image/png",
            url: `data:image/png;base64,${result.data}`,
          }],
        }
      } catch (e: any) {
        return { title: "Error", metadata: {}, output: `Failed to screenshot: ${e.message}` }
      }
    }

    if (action === "click") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      if (!params.selector) return { title: "Error", metadata: {}, output: "Must provide 'selector'." }

      const pageWs = browser.pages.get(browser.targetId)
      if (!pageWs) return { title: "Error", metadata: {}, output: "No page connected." }

      try {
        const result = await cdpSend(pageWs, "Runtime.evaluate", {
          expression: `document.querySelector('${params.selector.replace(/'/g, "\\'")}')`,
          returnByValue: true,
        })
        if (!result.result?.objectId) {
          return { title: "Error", metadata: {}, output: `Element not found: ${params.selector}` }
        }

        const clickResult = await cdpSend(pageWs, "Runtime.evaluate", {
          expression: `(function() { const el = document.querySelector('${params.selector.replace(/'/g, "\\'")}'); if (!el) return 'not found'; el.click(); return 'clicked'; })()`,
          returnByValue: true,
        })

        return {
          title: `Clicked: ${params.selector}`,
          metadata: { selector: params.selector },
          output: clickResult.result?.value === "clicked"
            ? `Clicked element: ${params.selector}`
            : `Element not found: ${params.selector}`,
        }
      } catch (e: any) {
        return { title: "Error", metadata: {}, output: `Failed to click: ${e.message}` }
      }
    }

    if (action === "type") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      if (!params.selector || !params.text) return { title: "Error", metadata: {}, output: "Must provide 'selector' and 'text'." }

      const pageWs = browser.pages.get(browser.targetId)
      if (!pageWs) return { title: "Error", metadata: {}, output: "No page connected." }

      try {
        await cdpSend(pageWs, "Runtime.evaluate", {
          expression: `(function() { const el = document.querySelector('${params.selector.replace(/'/g, "\\'")}'); if (!el) return 'not found'; el.focus(); el.value = ''; el.value = ${JSON.stringify(params.text)}; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); return 'typed'; })()`,
          returnByValue: true,
        })

        return {
          title: `Typed into: ${params.selector}`,
          metadata: { selector: params.selector },
          output: `Typed "${params.text}" into ${params.selector}`,
        }
      } catch (e: any) {
        return { title: "Error", metadata: {}, output: `Failed to type: ${e.message}` }
      }
    }

    if (action === "close") {
      const browser = browsers.get(params.browserId || "")
      if (!browser) return { title: "Error", metadata: {}, output: "No browser found." }

      for (const ws of browser.pages.values()) {
        try { ws.close() } catch {}
      }
      try { browser.proc.kill() } catch {}
      browsers.delete(browser.id)

      return {
        title: "Browser closed",
        metadata: { browserId: browser.id },
        output: `Browser ${browser.id} closed and cleaned up.`,
      }
    }

    if (action === "list") {
      const list = Array.from(browsers.entries()).map(([id, b]) =>
        `Browser ${id}: port ${b.port}, ${b.networkLog.length} network requests captured, ${b.pages.size} pages`
      )

      return {
        title: `${browsers.size} browser instances`,
        metadata: { count: browsers.size },
        output: browsers.size === 0
          ? "No browser instances running. Use action: launch to start one."
          : `Running browsers:\n${list.join("\n")}`,
      }
    }

    return { title: "Unknown action", metadata: {}, output: `Unknown action: ${action}` }
  },
})
