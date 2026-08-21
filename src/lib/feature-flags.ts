// Feature flags — controls opt-in experimental features in the DEA Web Viewer.
// Default behaviour: all flags off. Set DEA_EXPERIMENTAL_MATURITY_V2=1 to enable.
//
// CR-MM-02-VIEWER Stage 2.
//
// The viewer is a SPA with no runtime config; this is the simplest mechanism
// that doesn't require a build-time config. For richer flag management later,
// consider moving to the metamodel-driven feature flag pattern from CR-8.

/** Storage key for the localStorage override (dev only). */
const LS_PREFIX = 'dea.experimental.'

/** Build-time env override, looked up on first flag access. */
function readEnv(key: string): boolean | null {
  // Vite exposes import.meta.env at build time
  const env = (import.meta as any).env
  if (!env) return null
  const v = env[key]
  if (v === true || v === '1' || v === 'true') return true
  if (v === false || v === '0' || v === 'false') return false
  return null
}

/**
 * In-memory + localStorage override. Falls back to a process-local Map
 * when localStorage is unavailable (Node tests, SSR, etc.) so the flag
 * system is observable in any environment.
 */
const memoryOverrides = new Map<string, boolean>()

function readLocalStorage(key: string): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
    return null
  } catch {
    return null
  }
}

/** Toggle the localStorage (or in-memory) override for dev / preview / tests. */
export function setExperimentalFlag(key: string, on: boolean): void {
  memoryOverrides.set(key, on)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_PREFIX + key, on ? '1' : '0')
  } catch {
    // ignore quota errors etc.
  }
}

function readMemoryOverride(key: string): boolean | null {
  return memoryOverrides.has(key) ? memoryOverrides.get(key)! : null
}

export type FlagId =
  | 'maturityV2'   // CR-MM-02 — dual-band maturity radar (v1 behind, v2 front)

const FLAG_DEFAULTS: Record<FlagId, boolean> = {
  maturityV2: false,  // OFF by default
}

/**
 * Resolve a feature flag in the order: localStorage override → build-time
 * env override → default. Returns the effective on/off state.
 */
export function flag(key: FlagId): boolean {
  // In-memory override wins first (so tests + dev consoles can toggle
  // without needing localStorage). Then localStorage, then env, then default.
  const mem = readMemoryOverride(key)
  if (mem !== null) return mem
  const ls = readLocalStorage(key)
  if (ls !== null) return ls
  const envKey = 'VITE_' + key.replace(/[A-Z]/g, m => '_' + m).toUpperCase()
  const env = readEnv(envKey)
  if (env !== null) return env
  return FLAG_DEFAULTS[key]
}

/** Returns the names of all flags currently set (true). For the diagnostic page. */
export function activeFlags(): FlagId[] {
  return (Object.keys(FLAG_DEFAULTS) as FlagId[]).filter(flag)
}
