import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

export interface KnowledgeEntry {
  id: string;
  agent: string;
  feature: string;
  summary: string;
  branch?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface FeatureSummary {
  feature: string;
  count: number;
}

export class KnowledgeDatabase {
  private db: Database.Database;

  constructor() {
    const dbDir = path.join(os.homedir(), '.agent_knowledge_mcp');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'knowledge.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_corpus (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        feature TEXT NOT NULL,
        summary TEXT NOT NULL,
        branch TEXT,
        metadata TEXT,
        timestamp TEXT NOT NULL
      )
    `);

    // Create indexes for common queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_feature ON knowledge_corpus(feature);
      CREATE INDEX IF NOT EXISTS idx_agent ON knowledge_corpus(agent);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON knowledge_corpus(timestamp);
    `);
  }

  share(
    agent: string,
    feature: string,
    summary: string,
    branch?: string,
    metadata?: Record<string, any>
  ): KnowledgeEntry {
    const id = this.generateId();
    const timestamp = new Date().toISOString();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    const stmt = this.db.prepare(`
      INSERT INTO knowledge_corpus (id, agent, feature, summary, branch, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, agent, feature, summary, branch || null, metadataJson, timestamp);

    return {
      id,
      agent,
      feature,
      summary,
      branch,
      metadata,
      timestamp,
    };
  }

  retrieve(feature?: string, agent?: string, limit?: number): KnowledgeEntry[] {
    let query = 'SELECT * FROM knowledge_corpus WHERE 1=1';
    const params: any[] = [];

    if (feature) {
      query += ' AND feature = ?';
      params.push(feature);
    }

    if (agent) {
      query += ' AND agent = ?';
      params.push(agent);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(this.rowToEntry);
  }

  update(id: string, summary: string, metadata?: Record<string, any>): KnowledgeEntry | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const metadataJson = metadata ? JSON.stringify(metadata) : existing.metadata ? JSON.stringify(existing.metadata) : null;
    const timestamp = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE knowledge_corpus
      SET summary = ?, metadata = ?, timestamp = ?
      WHERE id = ?
    `);

    stmt.run(summary, metadataJson, timestamp, id);

    return this.getById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM knowledge_corpus WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  deleteByFeature(feature: string): number {
    const stmt = this.db.prepare('DELETE FROM knowledge_corpus WHERE feature = ?');
    const result = stmt.run(feature);
    return result.changes;
  }

  deleteAll(): number {
    const stmt = this.db.prepare('DELETE FROM knowledge_corpus');
    const result = stmt.run();
    return result.changes;
  }

  getById(id: string): KnowledgeEntry | null {
    const stmt = this.db.prepare('SELECT * FROM knowledge_corpus WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.rowToEntry(row) : null;
  }

  getFeatures(): FeatureSummary[] {
    const stmt = this.db.prepare(`
      SELECT feature, COUNT(*) as count
      FROM knowledge_corpus
      GROUP BY feature
      ORDER BY feature
    `);
    return stmt.all() as FeatureSummary[];
  }

  private rowToEntry(row: any): KnowledgeEntry {
    return {
      id: row.id,
      agent: row.agent,
      feature: row.feature,
      summary: row.summary,
      branch: row.branch || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamp: row.timestamp,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  close(): void {
    this.db.close();
  }
}
