import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const workspaces=sqliteTable("workspaces",{userId:text("user_id").primaryKey(),data:text("data").notNull(),version:integer("version").notNull().default(0),updatedAt:text("updated_at").notNull()});
// Um chat privado do Telegram por usuário; history e pending guardam JSON da conversa e das sugestões aguardando confirmação.
export const telegramLinks=sqliteTable("telegram_links",{chatId:text("chat_id").primaryKey(),userId:text("user_id").notNull().unique(),label:text("label").notNull(),history:text("history").notNull().default("[]"),pending:text("pending").notNull().default("{}"),lastUpdateId:integer("last_update_id").notNull().default(0),linkedAt:text("linked_at").notNull()});
export const telegramCodes=sqliteTable("telegram_codes",{code:text("code").primaryKey(),userId:text("user_id").notNull(),expiresAt:text("expires_at").notNull()});
