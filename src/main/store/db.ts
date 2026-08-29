import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'

let db: Database.Database | null = null

/**
 * Base locale unique. Elle vit dans userData, jamais dans le bundle :
 * une mise a jour de Boris ne doit pas effacer l'historique.
 */
export function getDb(): Database.Database {
  if (db) return db

  db = new Database(join(app.getPath('userData'), 'boris.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id      TEXT PRIMARY KEY,
      done    INTEGER NOT NULL DEFAULT 0,
      done_at TEXT
    );

    -- Journal des cycles : c'est lui qui permet a Boris de savoir
    -- s'il s'est deja manifeste aujourd'hui.
    CREATE TABLE IF NOT EXISTS cycles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at  TEXT NOT NULL,
      trigger     TEXT NOT NULL,
      duration_ms INTEGER,
      severity    TEXT NOT NULL DEFAULT 'nominal',
      revealed    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_cycles_started ON cycles(started_at);

    -- Cotations horodatees : sert aux seuils et, plus tard, aux variations.
    CREATE TABLE IF NOT EXISTS quotes (
      quote_id   TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      price      REAL,
      change_pct REAL,
      PRIMARY KEY (quote_id, fetched_at)
    );
    CREATE INDEX IF NOT EXISTS idx_quotes_id ON quotes(quote_id, fetched_at DESC);

    -- Cache Scryfall. Leur politique d'acces l'exige explicitement :
    -- une carte deja resolue ne doit pas etre redemandee.
    CREATE TABLE IF NOT EXISTS cards (
      name_key   TEXT PRIMARY KEY,
      payload    TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    -- Deck importe, sous sa forme resolue.
    CREATE TABLE IF NOT EXISTS decks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      source_file TEXT,
      imported_at TEXT NOT NULL,
      payload     TEXT NOT NULL
    );

    -- Historique des campagnes de simulation.
    CREATE TABLE IF NOT EXISTS sim_runs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at    TEXT NOT NULL,
      deck_name TEXT NOT NULL,
      games     INTEGER NOT NULL,
      opponents INTEGER NOT NULL,
      payload   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sim_runs_at ON sim_runs(run_at DESC);

    -- Illustration choisie pour une carte.
    --
    -- Hors du deck volontairement : un deck est un instantane, et
    -- revenir a une version anterieure ne doit pas defaire un choix
    -- graphique. L'art suit la carte, pas la liste.
    CREATE TABLE IF NOT EXISTS card_arts (
      card_name        TEXT PRIMARY KEY,
      scryfall_id      TEXT NOT NULL,
      set_code         TEXT NOT NULL,
      set_name         TEXT NOT NULL DEFAULT '',
      collector_number TEXT NOT NULL,
      artist           TEXT,
      image_normal     TEXT,
      price_eur        REAL,
      chosen_at        TEXT NOT NULL
    );
  `)

  migrate(db)
  return db
}

/** Migrations additives — chaque colonne est ajoutee si elle manque. */
function migrate(d: Database.Database): void {
  const cols = (table: string): Set<string> =>
    new Set((d.pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name))

  if (!cols('cycles').has('fingerprint')) {
    d.exec('ALTER TABLE cycles ADD COLUMN fingerprint TEXT')
  }
}

export function closeDb(): void {
  db?.close()
  db = null
}
