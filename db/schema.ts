import { pgTable, text, integer, bigint, primaryKey } from "drizzle-orm/pg-core";
export const workspaces=pgTable("workspaces",{userId:text("user_id").primaryKey(),data:text("data").notNull(),version:integer("version").notNull().default(0),updatedAt:text("updated_at").notNull()});
// Um chat privado do Telegram por usuário; history e pending guardam JSON da conversa e das sugestões aguardando confirmação.
export const telegramLinks=pgTable("telegram_links",{chatId:text("chat_id").primaryKey(),userId:text("user_id").notNull().unique(),label:text("label").notNull(),history:text("history").notNull().default("[]"),pending:text("pending").notNull().default("{}"),lastUpdateId:bigint("last_update_id",{mode:"number"}).notNull().default(0),linkedAt:text("linked_at").notNull()});
export const telegramCodes=pgTable("telegram_codes",{code:text("code").primaryKey(),userId:text("user_id").notNull(),expiresAt:text("expires_at").notNull()});
// Usos por dia de recursos que custam IA (envio e parecer de exames). Excluir o exame não devolve a cota.
export const usageCounters=pgTable("usage_counters",{userId:text("user_id").notNull(),kind:text("kind").notNull(),day:text("day").notNull(),count:integer("count").notNull().default(0)},t=>[primaryKey({columns:[t.userId,t.kind,t.day]})]);
