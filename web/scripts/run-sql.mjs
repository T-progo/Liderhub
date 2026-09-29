// Runs SQL files against the Supabase database, in the order given.
//
//   node --env-file=.env.local scripts/run-sql.mjs ../supabase/schema.sql ../supabase/002_liderhub.sql ../supabase/003_tipos.sql
//
// Needs DATABASE_URL (Supabase > Connect > Session pooler URI) in .env.local.
import { readFileSync } from "node:fs";
import pg from "pg";

const arquivos = process.argv.slice(2);
if (!process.env.DATABASE_URL || !arquivos.length) {
  console.error("Uso: node --env-file=.env.local scripts/run-sql.mjs <arquivo.sql>...  (DATABASE_URL em .env.local)");
  process.exit(1);
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  for (const f of arquivos) {
    await db.query(readFileSync(f, "utf8"));
    console.log(`ok  ${f}`);
  }
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
