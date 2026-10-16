import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Uma conexão por instância da função, reaproveitada entre requisições (e entre recargas no `next dev`).
const cache = globalThis as unknown as { geoaiDb?: ReturnType<typeof create> };

function create(url: string) {
  // prepare:false é exigido pelo pooler do Neon (PgBouncer em modo transação).
  const client = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX) || 5 });
  return drizzle(client, { schema });
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não configurada. Na Vercel, conecte um banco Postgres (Neon) em Storage ou defina a variável no projeto.");
  }
  cache.geoaiDb ??= create(url);
  return cache.geoaiDb;
}
