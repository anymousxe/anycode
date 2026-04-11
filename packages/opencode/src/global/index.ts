import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import path from "path"
import os from "os"
import { Filesystem } from "../util/filesystem"

const app = "anycode"
const legacyApp = "opencode"

const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
const config = path.join(xdgConfig!, app)
const state = path.join(xdgState!, app)

const legacyData = path.join(xdgData!, legacyApp)
const legacyCache = path.join(xdgCache!, legacyApp)
const legacyConfig = path.join(xdgConfig!, legacyApp)
const legacyState = path.join(xdgState!, legacyApp)

async function migrateDir(src: string, dest: string) {
  try {
    await fs.access(src)
  } catch { return }
  let destEmpty = true
  try {
    const items = await fs.readdir(dest)
    destEmpty = items.length === 0
  } catch { destEmpty = true }
  if (!destEmpty) return
  try {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })
    for (const entry of entries) {
      const from = path.join(src, entry.name)
      const to = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        await fs.mkdir(to, { recursive: true })
        const inner = await fs.readdir(from, { withFileTypes: true })
        for (const f of inner) {
          await fs.rename(path.join(from, f.name), path.join(to, f.name)).catch(() => {})
        }
      } else {
        await fs.rename(from, to)
      }
    }
    try { await fs.rm(src, { recursive: true, force: true }) } catch {}
  } catch {}
}

await migrateDir(legacyData, data)
await migrateDir(legacyCache, cache)
await migrateDir(legacyConfig, config)
await migrateDir(legacyState, state)

export namespace Global {
  export const Path = {
    // Allow override via OPENCODE_TEST_HOME for test isolation
    get home() {
      return process.env.OPENCODE_TEST_HOME || os.homedir()
    },
    data,
    bin: path.join(cache, "bin"),
    log: path.join(data, "log"),
    cache,
    config,
    state,
  }
}

await Promise.all([
  fs.mkdir(Global.Path.data, { recursive: true }),
  fs.mkdir(Global.Path.config, { recursive: true }),
  fs.mkdir(Global.Path.state, { recursive: true }),
  fs.mkdir(Global.Path.log, { recursive: true }),
  fs.mkdir(Global.Path.bin, { recursive: true }),
])

const CACHE_VERSION = "21"

const version = await Filesystem.readText(path.join(Global.Path.cache, "version")).catch(() => "0")

if (version !== CACHE_VERSION) {
  try {
    const contents = await fs.readdir(Global.Path.cache)
    await Promise.all(
      contents.map((item) =>
        fs.rm(path.join(Global.Path.cache, item), {
          recursive: true,
          force: true,
        }),
      ),
    )
  } catch (e) {}
  await Filesystem.write(path.join(Global.Path.cache, "version"), CACHE_VERSION)
}
