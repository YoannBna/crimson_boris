import type { Settings } from '@shared/types'
import { getDb } from './db'

const DEFAULTS: Settings = {
  intervalMinutes: 30,
  launchAtLogin: true,
  revealOnCritical: true,
  revealCooldownMinutes: 240
}

export function readSettings(): Settings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]

  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    intervalMinutes: num(stored.intervalMinutes, DEFAULTS.intervalMinutes),
    launchAtLogin: bool(stored.launchAtLogin, DEFAULTS.launchAtLogin),
    revealOnCritical: bool(stored.revealOnCritical, DEFAULTS.revealOnCritical),
    revealCooldownMinutes: num(stored.revealCooldownMinutes, DEFAULTS.revealCooldownMinutes)
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const stmt = getDb().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) stmt.run(k, String(v))
  }
  return readSettings()
}

function num(v: string | undefined, fallback: number): number {
  const n = v === undefined ? NaN : Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback
  return v === 'true'
}
