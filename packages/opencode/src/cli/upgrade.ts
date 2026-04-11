import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Flag } from "@/flag/flag"
import { Installation } from "@/installation"
import { Log } from "@/util/log"

const log = Log.create({ service: "upgrade" })

export async function upgrade() {
  const config = await Config.getGlobal()
  const method = await Installation.method()
  const latest = await Installation.latest(method).catch((err) => {
    log.error("failed to fetch latest version", { error: String(err) })
    return undefined
  })
  if (!latest) return

  if (Flag.OPENCODE_ALWAYS_NOTIFY_UPDATE) {
    await Bus.publish(Installation.Event.UpdateAvailable, { version: latest })
    return
  }

  if (Installation.VERSION === latest) return
  if (config.autoupdate === false || Flag.OPENCODE_DISABLE_AUTOUPDATE) return

  const kind = Installation.getReleaseType(Installation.VERSION, latest)

  if (config.autoupdate === "notify" || kind !== "patch") {
    await Bus.publish(Installation.Event.UpdateAvailable, { version: latest })
    return
  }

  if (method === "unknown") return
  await Installation.upgrade(method, latest)
    .then(() => Bus.publish(Installation.Event.Updated, { version: latest }))
    .catch((err) => {
      log.error("auto-upgrade failed", { error: String(err) })
    })
}
