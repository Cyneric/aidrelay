const { join } = require('node:path')
const Database = require('better-sqlite3')

const dbPath = join(process.env.APPDATA || '', 'aidrelay', 'aidrelay.db')
console.log('dbPath=', dbPath)
const db = new Database(dbPath, { readonly: true, fileMustExist: true })

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
console.log('tables=', tables.map((t) => t.name).join(', '))

for (const t of ['rules','servers','profiles','activity_log','backups']) {
  try {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get()
    console.log(`${t}=${row.c}`)
  } catch (err) {
    console.log(`${t}=ERR:${err.message}`)
  }
}

try {
  const rows = db
    .prepare('SELECT id,name,scope,enabled,updated_at FROM rules ORDER BY updated_at DESC LIMIT 10')
    .all()
  console.log('recent_rules=', JSON.stringify(rows, null, 2))
} catch (err) {
  console.log('recent_rules_err=', err.message)
}

db.close()
