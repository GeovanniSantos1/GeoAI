CREATE TABLE "telegram_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"history" text DEFAULT '[]' NOT NULL,
	"pending" text DEFAULT '{}' NOT NULL,
	"last_update_id" bigint DEFAULT 0 NOT NULL,
	"linked_at" text NOT NULL,
	CONSTRAINT "telegram_links_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);
