// Acceso a datos con la misma interfaz para MySQL (producción) y SQLite (pruebas/demo sin MySQL):
//   query(sql, params) -> filas   one(...) -> fila|null   run(...) -> {insertId, filas}   tx(fn)
// SQL portable: parámetros `?`, fechas calculadas en JS, sin funciones propias de MySQL.
export async function crearBdMysql(cfg) {
  const mysql = await import('mysql2/promise');
  const pool = mysql.createPool({ ...cfg, waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4', dateStrings: true, decimalNumbers: true, namedPlaceholders: false });
  const api = (ex) => ({
    query: async (sql, p = []) => (await ex.query(sql, p))[0],
    one: async (sql, p = []) => (await ex.query(sql, p))[0][0] ?? null,
    run: async (sql, p = []) => { const [r] = await ex.query(sql, p); return { insertId: r.insertId, filas: r.affectedRows }; },
  });
  return {
    ...api(pool),
    async tx(fn) {
      const c = await pool.getConnection();
      try { await c.beginTransaction(); const r = await fn(api(c)); await c.commit(); return r; }
      catch (e) { await c.rollback(); throw e; } finally { c.release(); }
    },
    cerrar: () => pool.end(),
    motor: 'mysql',
  };
}

/** Convierte el DDL de MySQL (bd02_reposteria.sql) a SQLite. Solo para pruebas locales. */
export function ddlASqlite(sql) {
  const bloques = [], inserts = [];
  for (const m of sql.matchAll(/CREATE TABLE `(\w+)` \(([\s\S]*?)\n\) ENGINE=InnoDB;/g)) {
    const lineas = m[2].split('\n').map((l) => l.trim().replace(/,$/, '')).filter(Boolean);
    const cols = [];
    for (const l of lineas) {
      if (/^(KEY|CONSTRAINT|FOREIGN)/.test(l)) continue;
      let u;
      if ((u = l.match(/^UNIQUE KEY `\w+` \((.*)\)$/))) { cols.push(`UNIQUE (${u[1]})`); continue; }
      if (/^PRIMARY KEY/.test(l)) { if (!lineas.some((x) => /AUTO_INCREMENT/.test(x))) cols.push(l); continue; }
      cols.push(l.replace(/^(`\w+`)\s+\w+(\(\d+(,\d+)?\))?\s+(.*?)AUTO_INCREMENT/, '$1 INTEGER PRIMARY KEY AUTOINCREMENT $4').replace(/CURRENT_TIMESTAMP\(3\)/g, 'CURRENT_TIMESTAMP'));
    }
    bloques.push(`CREATE TABLE \`${m[1]}\` (\n  ${cols.join(',\n  ')}\n);`);
  }
  for (const m of sql.matchAll(/INSERT INTO[\s\S]*?;/g)) inserts.push(m[0]);
  return [...bloques, ...inserts].join('\n');
}

export async function crearBdSqlite(rutaSql, archivo = ':memory:') {
  const { DatabaseSync } = await import('node:sqlite');
  const { readFileSync } = await import('node:fs');
  const d = new DatabaseSync(archivo);
  d.exec('PRAGMA foreign_keys = OFF');
  d.exec(ddlASqlite(readFileSync(rutaSql, 'utf8')));
  d.exec('PRAGMA foreign_keys = ON');
  const api = {
    query: async (sql, p = []) => d.prepare(sql).all(...p),
    one: async (sql, p = []) => d.prepare(sql).get(...p) ?? null,
    run: async (sql, p = []) => { const r = d.prepare(sql).run(...p); return { insertId: Number(r.lastInsertRowid), filas: Number(r.changes) }; },
  };
  let cola = Promise.resolve();
  return {
    ...api,
    tx(fn) { // una transacción a la vez (una sola conexión)
      const t = cola.then(async () => { d.exec('BEGIN'); try { const r = await fn(api); d.exec('COMMIT'); return r; } catch (e) { d.exec('ROLLBACK'); throw e; } });
      cola = t.catch(() => {}); return t;
    },
    cerrar: async () => d.close(),
    motor: 'sqlite',
  };
}
