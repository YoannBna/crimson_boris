import { app, safeStorage } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AppConfig,
  ConnectorId,
  ConnectorStatus,
  OperatorProfile
} from '@shared/config'
import { CONNECTOR_FIELDS, DEFAULT_PROFILE } from '@shared/config'
import { getDb } from './store/db'

/*
 * Configuration et secrets.
 *
 * Deux stockages distincts, et c'est deliberé :
 *
 *   - les REGLAGES (nom affiche, fuseau, tickers, flux) vivent en clair
 *     dans SQLite. Ils ne revelent rien et doivent rester lisibles.
 *
 *   - les SECRETS (mots de passe d'application, jetons) passent par
 *     `safeStorage`, qui s'adosse au trousseau du systeme : Keychain sur
 *     macOS, DPAPI sur Windows. La cle de chiffrement appartient a la
 *     session de l'utilisateur ; elle ne se trouve nulle part dans le
 *     projet, et un fichier vole hors de la session est illisible.
 *
 * Un secret ne remonte JAMAIS au renderer. L'interface n'apprend que son
 * existence — jamais sa valeur. Ce qui n'est pas transmis ne peut pas
 * fuir par une capture d'ecran, un journal ou un rapport d'erreur.
 */

/** Variables d'environnement lues au demarrage, pour un poste de developpement. */
function envOverride(key: string): string | null {
  const v = process.env[key]
  return v && v.trim() !== '' ? v.trim() : null
}

/**
 * Fichier d'environnement facultatif, a la racine du projet et exclu du
 * controle de version. Il ne sert qu'au developpement : en production,
 * les secrets vivent dans le trousseau du systeme.
 */
function loadDotEnv(): void {
  if (app.isPackaged) return
  try {
    const raw = readFileSync(join(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
      if (!m) continue
      const value = m[2].replace(/^["']|["']$/g, '').trim()
      if (value !== '' && process.env[m[1]] === undefined) process.env[m[1]] = value
    }
  } catch {
    // Absence de fichier .env : cas normal, pas une erreur.
  }
}

let loaded = false

function ensureLoaded(): void {
  if (loaded) return
  loadDotEnv()
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    -- Les secrets sont stockes chiffres ; la colonne ne contient jamais
    -- de texte lisible, meme si le fichier de base est copie ailleurs.
    CREATE TABLE IF NOT EXISTS secrets (
      connector TEXT NOT NULL,
      key       TEXT NOT NULL,
      cipher    BLOB NOT NULL,
      set_at    TEXT NOT NULL,
      PRIMARY KEY (connector, key)
    );
  `)
  loaded = true
}

/* ============================================================
   Reglages
   ============================================================ */

function readRaw(key: string): string | null {
  ensureLoaded()
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

function writeRaw(key: string, value: string): void {
  ensureLoaded()
  getDb()
    .prepare(
      'INSERT INTO config (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value)
}

export function readProfile(): OperatorProfile {
  const raw = readRaw('profile')
  if (!raw) return { ...DEFAULT_PROFILE }
  try {
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<OperatorProfile>) }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function writeProfile(patch: Partial<OperatorProfile>): OperatorProfile {
  const next = { ...readProfile(), ...patch }
  writeRaw('profile', JSON.stringify(next))
  return next
}

/* ============================================================
   Secrets
   ============================================================ */

export function secureAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function setSecret(connector: ConnectorId, key: string, value: string): void {
  ensureLoaded()
  if (value.trim() === '') {
    getDb().prepare('DELETE FROM secrets WHERE connector = ? AND key = ?').run(connector, key)
    return
  }
  if (!secureAvailable()) {
    // Refus explicite plutot qu'un stockage en clair silencieux : mieux
    // vaut un connecteur non configure qu'un mot de passe lisible.
    throw new Error(
      "Le trousseau du systeme est indisponible : Boris refuse d'ecrire un secret en clair."
    )
  }
  const cipher = safeStorage.encryptString(value)
  getDb()
    .prepare(
      'INSERT INTO secrets (connector, key, cipher, set_at) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(connector, key) DO UPDATE SET cipher = excluded.cipher, set_at = excluded.set_at'
    )
    .run(connector, key, cipher, new Date().toISOString())
}

/**
 * Lecture d'un secret. Reservee au process principal — ce module n'est
 * jamais importe par le renderer, et aucun canal IPC ne l'expose.
 */
export function getSecret(connector: ConnectorId, key: string): string | null {
  const fromEnv = envOverride(key)
  if (fromEnv) return fromEnv

  ensureLoaded()
  const row = getDb()
    .prepare('SELECT cipher FROM secrets WHERE connector = ? AND key = ?')
    .get(connector, key) as { cipher: Buffer } | undefined
  if (!row) return null

  try {
    return safeStorage.decryptString(row.cipher)
  } catch {
    // Session differente, trousseau reinitialise : le secret est perdu,
    // pas corrompu. On le signale par un retour vide.
    return null
  }
}

function hasSecret(connector: ConnectorId, key: string): boolean {
  if (envOverride(key)) return true
  ensureLoaded()
  const row = getDb()
    .prepare('SELECT 1 AS ok FROM secrets WHERE connector = ? AND key = ?')
    .get(connector, key) as { ok: number } | undefined
  return row !== undefined
}

export function clearConnector(connector: ConnectorId): void {
  ensureLoaded()
  getDb().prepare('DELETE FROM secrets WHERE connector = ?').run(connector)
  const skipped = readSkipped().filter((c) => c !== connector)
  writeRaw('skipped', JSON.stringify(skipped))
}

function readSkipped(): ConnectorId[] {
  try {
    return JSON.parse(readRaw('skipped') ?? '[]') as ConnectorId[]
  } catch {
    return []
  }
}

export function skipConnector(connector: ConnectorId): void {
  const skipped = new Set(readSkipped())
  skipped.add(connector)
  writeRaw('skipped', JSON.stringify([...skipped]))
}

/* ============================================================
   Etat global
   ============================================================ */

function connectorStatus(id: ConnectorId): ConnectorStatus {
  const fields = CONNECTOR_FIELDS[id]
  const required = fields.filter((f) => !f.optional)
  const complete = required.length > 0 && required.every((f) => hasSecret(id, f.key))

  if (complete) {
    // Un libelle de compte, jamais un secret : c'est ce qui distingue
    // « configure » d'« identifiants exposes ».
    const account =
      id === 'mail'
        ? maskAccount(getSecret('mail', 'IMAP_USER'))
        : id === 'archidekt'
          ? getSecret('archidekt', 'ARCHIDEKT_USER')
          : null
    return { id, state: 'configure', account }
  }

  if (readSkipped().includes(id)) return { id, state: 'ignore', account: null }
  return { id, state: 'absent', account: null }
}

/** n****@domaine.fr — assez pour se reconnaitre, pas assez pour etre reutilise. */
function maskAccount(value: string | null): string | null {
  if (!value) return null
  const at = value.indexOf('@')
  if (at <= 1) return '•••'
  return `${value[0]}${'•'.repeat(Math.max(3, at - 1))}${value.slice(at)}`
}

export function readConfig(): AppConfig {
  ensureLoaded()
  return {
    onboarded: readRaw('onboarded') === 'true',
    profile: readProfile(),
    connectors: (['mail', 'markets', 'archidekt'] as ConnectorId[]).map(connectorStatus),
    secureStorageAvailable: secureAvailable()
  }
}

export function completeOnboarding(): AppConfig {
  writeRaw('onboarded', 'true')
  return readConfig()
}

/**
 * Effacement complet des donnees locales.
 * Reponse technique au droit a l'effacement : rien ne subsiste hors du
 * poste, il n'y a donc rien d'autre a demander a personne.
 */
export function purgeAll(): void {
  ensureLoaded()
  getDb().exec(`
    DELETE FROM secrets;
    DELETE FROM config;
    DELETE FROM tasks;
    DELETE FROM decks;
    DELETE FROM sim_runs;
    DELETE FROM quotes;
    DELETE FROM cycles;
    DELETE FROM cards;
  `)
}
