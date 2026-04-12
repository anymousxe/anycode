import { Effect } from "effect"
import { EffectLogger } from "@/effect/logger"

export function runPromiseLogged<A, E>(effect: Effect.Effect<A, E>) {
  return Effect.runPromise(effect.pipe(Effect.provide(EffectLogger.layer)))
}

export function runForkLogged<A, E>(effect: Effect.Effect<A, E>) {
  return Effect.runFork(effect.pipe(Effect.provide(EffectLogger.layer)))
}
