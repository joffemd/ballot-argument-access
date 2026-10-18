import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
export const token = () => randomBytes(32).toString('hex');
export const hash = s => createHash('sha256').update(s).digest('hex');
export class Store {
  constructor(path=':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, body TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY, at TEXT, actor TEXT, action TEXT, object_id TEXT, previous TEXT, digest TEXT);`);
  }
  all(kind) { return this.db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid').all(kind).map(r=>JSON.parse(r.body)); }
  get(kind,id) { const r=this.db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(kind,id); return r ? JSON.parse(r.body) : null; }
  put(kind,row) { this.db.prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(kind,row.id,JSON.stringify(row)); return row; }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const r=fn(); this.db.exec('COMMIT'); return r; } catch(e) { this.db.exec('ROLLBACK'); throw e; } }
  audit(actor,action,id,at) { const previous=this.db.prepare('SELECT digest FROM audit ORDER BY seq DESC LIMIT 1').get()?.digest || ''; const digest=hash(JSON.stringify({at,actor,action,id,previous})); this.db.prepare('INSERT INTO audit(at,actor,action,object_id,previous,digest) VALUES(?,?,?,?,?,?)').run(at,actor,action,id,previous,digest); }
  close(){this.db.close();}
}
