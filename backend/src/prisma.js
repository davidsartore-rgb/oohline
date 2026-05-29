'use strict';
const mysql = require('mysql2/promise');

// ── Connection pool ────────────────────────────────────────────────────────────
function parseDbUrl(url) {
  const u = new URL(url);
  const socketPath = u.searchParams.get('socket');
  const base = {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    waitForConnections: true,
    connectionLimit: 10,
    timezone: '+00:00',
    supportBigNumbers: true,
    bigNumberStrings: false,
  };
  return socketPath
    ? { ...base, socketPath }
    : { ...base, host: u.hostname, port: Number(u.port) || 3306 };
}

let _pool;
const getPool = () => {
  if (!_pool) _pool = mysql.createPool(parseDbUrl(process.env.DATABASE_URL));
  return _pool;
};

// ── SQL helpers ────────────────────────────────────────────────────────────────
function buildWhere(conditions) {
  if (!conditions || !Object.keys(conditions).length) return { sql: '', params: [] };
  const parts = [], params = [];

  if (conditions.OR) {
    const orParts = [], orParams = [];
    for (const cond of conditions.OR) {
      const { sql, params: p } = buildWhere(cond);
      if (sql) { orParts.push(`(${sql.replace(/^WHERE /, '')})`); orParams.push(...p); }
    }
    if (orParts.length) { parts.push(`(${orParts.join(' OR ')})`); params.push(...orParams); }
    const rest = Object.fromEntries(Object.entries(conditions).filter(([k]) => k !== 'OR'));
    if (Object.keys(rest).length) {
      const { sql: s, params: p } = buildWhere(rest);
      if (s) { parts.push(s.replace(/^WHERE /, '')); params.push(...p); }
    }
    return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
  }

  for (const [col, val] of Object.entries(conditions)) {
    if (val === null || val === undefined) {
      parts.push(`\`${col}\` IS NULL`);
    } else if (val instanceof Date) {
      parts.push(`\`${col}\` = ?`); params.push(val);
    } else if (typeof val === 'object' && !Array.isArray(val) && !Buffer.isBuffer(val)) {
      for (const [op, v] of Object.entries(val)) {
        if (op === 'lt')       { parts.push(`\`${col}\` < ?`);  params.push(v); }
        else if (op === 'lte') { parts.push(`\`${col}\` <= ?`); params.push(v); }
        else if (op === 'gt')  { parts.push(`\`${col}\` > ?`);  params.push(v); }
        else if (op === 'gte') { parts.push(`\`${col}\` >= ?`); params.push(v); }
        else if (op === 'in')  { parts.push(`\`${col}\` IN (${v.map(() => '?').join(',')})`); params.push(...v); }
        else if (op === 'contains') { parts.push(`\`${col}\` LIKE ?`); params.push(`%${v}%`); }
        else if (op === 'not') {
          if (v === null) parts.push(`\`${col}\` IS NOT NULL`);
          else { parts.push(`\`${col}\` != ?`); params.push(v); }
        }
      }
    } else {
      parts.push(`\`${col}\` = ?`); params.push(val);
    }
  }
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

function buildOrderBy(orderBy) {
  if (!orderBy) return '';
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  return 'ORDER BY ' + entries.map(o => {
    const [col, dir] = Object.entries(o)[0];
    return `\`${col}\` ${dir === 'desc' ? 'DESC' : 'ASC'}`;
  }).join(', ');
}

function parseRow(row, jsonFields = []) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (jsonFields.includes(k)) {
      if (typeof v === 'string') { try { out[k] = JSON.parse(v); } catch { out[k] = v; } }
      else out[k] = v;
    } else if (typeof v === 'bigint') {
      out[k] = Number(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

// Flatten Prisma composite key syntax: { format_code_paper_id: { format_code, paper_id } }
function normalizeWhere(where) {
  const out = {};
  const opKeys = new Set(['lt','lte','gt','gte','in','not','contains','equals']);
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) &&
        !Object.keys(v).some(op => opKeys.has(op))) {
      Object.assign(out, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Model class ────────────────────────────────────────────────────────────────
class Model {
  constructor(table, { pk = 'id', jsonFields = [], relations = {} } = {}) {
    this.table = table;
    this.pk = pk;
    this.jsonFields = jsonFields;
    this.relations = relations;
  }

  _parse(row) { return parseRow(row, this.jsonFields); }

  async _include(row, include) {
    if (!row || !include) return row;
    const out = { ...row };
    for (const [rel, enabled] of Object.entries(include)) {
      if (!enabled || !this.relations[rel]) continue;
      const { table, fk, pk, jsonFields: jf = [] } = this.relations[rel];
      const [[r]] = await getPool().query(`SELECT * FROM \`${table}\` WHERE \`${pk}\` = ? LIMIT 1`, [row[fk]]);
      out[rel] = r ? parseRow(r, jf) : null;
    }
    return out;
  }

  async findMany({ where, orderBy, skip, take } = {}, conn) {
    const p = conn || getPool();
    const { sql: w, params } = buildWhere(where);
    const o = buildOrderBy(orderBy);
    const l = take != null ? `LIMIT ${Number(take)} OFFSET ${Number(skip) || 0}` : '';
    const [rows] = await p.query(`SELECT * FROM \`${this.table}\` ${w} ${o} ${l}`, params);
    return rows.map(r => this._parse(r));
  }

  async findFirst({ where, include } = {}, conn) {
    const p = conn || getPool();
    const { sql: w, params } = buildWhere(normalizeWhere(where || {}));
    const [rows] = await p.query(`SELECT * FROM \`${this.table}\` ${w} LIMIT 1`, params);
    const row = this._parse(rows[0] || null);
    return include ? this._include(row, include) : row;
  }

  async findUnique(args, conn) { return this.findFirst(args, conn); }

  async create({ data }, conn) {
    const p = conn || getPool();
    const cleaned = cleanData(data);
    const row = {};
    for (const [k, v] of Object.entries(cleaned)) {
      row[k] = this.jsonFields.includes(k) ? JSON.stringify(v) : v;
    }
    const cols = Object.keys(row).map(k => `\`${k}\``).join(', ');
    const ph = Object.keys(row).map(() => '?').join(', ');
    const [result] = await p.query(`INSERT INTO \`${this.table}\` (${cols}) VALUES (${ph})`, Object.values(row));
    const id = typeof result.insertId === 'bigint' ? Number(result.insertId) : result.insertId;
    if (id) {
      const pk = Array.isArray(this.pk) ? this.pk[0] : this.pk;
      return this.findFirst({ where: { [pk]: id } }, conn) || this._parse({ ...cleaned, [pk]: id });
    }
    const pkWhere = Array.isArray(this.pk)
      ? Object.fromEntries(this.pk.map(k => [k, cleaned[k]]))
      : { [this.pk]: cleaned[this.pk] };
    return this.findFirst({ where: pkWhere }, conn) || this._parse(cleaned);
  }

  async update({ where, data }, conn) {
    const p = conn || getPool();
    const cleaned = cleanData(data);
    if (!Object.keys(cleaned).length) return this.findFirst({ where }, conn);
    const row = {};
    for (const [k, v] of Object.entries(cleaned)) {
      row[k] = this.jsonFields.includes(k) ? JSON.stringify(v) : v;
    }
    const setCols = Object.keys(row).map(k => `\`${k}\` = ?`).join(', ');
    const { sql: w, params: wp } = buildWhere(normalizeWhere(where));
    await p.query(`UPDATE \`${this.table}\` SET ${setCols} ${w}`, [...Object.values(row), ...wp]);
    return this.findFirst({ where }, conn);
  }

  async upsert({ where, update, create: createData }, conn) {
    const nw = normalizeWhere(where);
    const existing = await this.findFirst({ where: nw }, conn);
    if (existing) return this.update({ where: nw, data: update }, conn);
    return this.create({ data: { ...nw, ...createData } }, conn);
  }

  async delete({ where }, conn) {
    const row = await this.findFirst({ where }, conn);
    const { sql: w, params } = buildWhere(normalizeWhere(where));
    await (conn || getPool()).query(`DELETE FROM \`${this.table}\` ${w}`, params);
    return row;
  }

  async deleteMany({ where } = {}, conn) {
    const { sql: w, params } = buildWhere(where || {});
    const [r] = await (conn || getPool()).query(`DELETE FROM \`${this.table}\` ${w}`, params);
    return { count: r.affectedRows };
  }

  async createMany({ data, skipDuplicates = false } = {}, conn) {
    if (!data?.length) return { count: 0 };
    const kw = skipDuplicates ? 'INSERT IGNORE' : 'INSERT';
    for (const item of data) {
      const row = {};
      for (const [k, v] of Object.entries(item)) {
        row[k] = this.jsonFields.includes(k) ? JSON.stringify(v) : v;
      }
      const cols = Object.keys(row).map(k => `\`${k}\``).join(', ');
      const ph = Object.keys(row).map(() => '?').join(', ');
      await (conn || getPool()).query(`${kw} INTO \`${this.table}\` (${cols}) VALUES (${ph})`, Object.values(row));
    }
    return { count: data.length };
  }

  async count({ where } = {}, conn) {
    const { sql: w, params } = buildWhere(where || {});
    const [[row]] = await (conn || getPool()).query(`SELECT COUNT(*) AS cnt FROM \`${this.table}\` ${w}`, params);
    return Number(row.cnt);
  }
}

// ── Models ─────────────────────────────────────────────────────────────────────
const userJf = ['backup_codes'];
const sessionRel = { user: { table: 'admin_users', fk: 'user_id', pk: 'id', jsonFields: userJf } };

const models = {
  section:       new Model('sections'),
  format:        new Model('formats'),
  paper:         new Model('papers'),
  formatPaper:   new Model('format_papers', { pk: ['format_code', 'paper_id'] }),
  volumeTier:    new Model('volume_tiers'),
  subjectFee:    new Model('subject_fees'),
  setting:       new Model('settings',      { pk: 'key', jsonFields: ['value'] }),
  pageText:      new Model('page_texts',    { pk: 'page' }),
  legalPage:     new Model('legal_pages'),
  headerConfig:  new Model('header_config'),
  footerConfig:  new Model('footer_config', { jsonFields: ['sections'] }),
  adminUser:     new Model('admin_users',   { jsonFields: userJf }),
  adminSession:  new Model('admin_sessions', { relations: sessionRel }),
  recoveryToken: new Model('recovery_tokens', {
    relations: { user: { table: 'admin_users', fk: 'user_id', pk: 'id', jsonFields: userJf } },
  }),
  quoteRequest:  new Model('quote_requests'),
  auditLog:      new Model('audit_log',    { jsonFields: ['before', 'after'] }),
};

// ── Transaction ────────────────────────────────────────────────────────────────
async function $transaction(callback) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const tx = Object.fromEntries(
      Object.entries(models).map(([name, model]) => [name, {
        findMany:   (a) => model.findMany(a, conn),
        findFirst:  (a) => model.findFirst(a, conn),
        findUnique: (a) => model.findUnique(a, conn),
        create:     (a) => model.create(a, conn),
        update:     (a) => model.update(a, conn),
        upsert:     (a) => model.upsert(a, conn),
        delete:     (a) => model.delete(a, conn),
        deleteMany: (a) => model.deleteMany(a, conn),
        createMany: (a) => model.createMany(a, conn),
        count:      (a) => model.count(a, conn),
      }])
    );
    const result = await callback(tx);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
module.exports = {
  ...models,
  $connect:     async () => { const c = await getPool().getConnection(); c.release(); },
  $disconnect:  async () => { if (_pool) { await _pool.end(); _pool = null; } },
  $transaction,
};
