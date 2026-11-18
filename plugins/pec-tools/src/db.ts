import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

let db: DatabaseSync | null = null

export function openDb(path = fileURLToPath(new URL('../../../db/pec.db', import.meta.url))): DatabaseSync {
  if (!db) db = new DatabaseSync(path, { readOnly: true })
  return db
}

export function all<T = unknown>(sql: string, params: unknown[] = []): T[] {
  return openDb().prepare(sql).all(...params as any[]) as T[]
}

export function one<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
  return openDb().prepare(sql).get(...params as any[]) as T | undefined
}
