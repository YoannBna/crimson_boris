import type { TaskState } from '@shared/types'
import { getDb } from './db'

export function readTasks(): TaskState[] {
  const rows = getDb().prepare('SELECT id, done, done_at FROM tasks').all() as {
    id: string
    done: number
    done_at: string | null
  }[]
  return rows.map((r) => ({ id: r.id, done: r.done === 1, doneAt: r.done_at }))
}

export function setTaskDone(id: string, done: boolean): TaskState[] {
  getDb()
    .prepare(
      'INSERT INTO tasks (id, done, done_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET done = excluded.done, done_at = excluded.done_at'
    )
    .run(id, done ? 1 : 0, done ? new Date().toISOString() : null)
  return readTasks()
}

/** Identifiants des taches cloturees — lecture directe pour le moteur de gravite. */
export function doneIds(): Set<string> {
  return new Set(readTasks().filter((t) => t.done).map((t) => t.id))
}
