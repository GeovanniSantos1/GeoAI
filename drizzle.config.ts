import { defineConfig } from "drizzle-kit";

// Migrações usam a conexão direta do Neon (sem pooler) quando a integração da Vercel a fornece.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url && process.argv.some((arg) => arg === "migrate" || arg === "push")) {
  throw new Error("DATABASE_URL não configurada. Na Vercel, conecte um banco Neon em Storage antes do deploy.");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: url ?? "" },
});
