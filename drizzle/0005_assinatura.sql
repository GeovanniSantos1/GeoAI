CREATE TABLE "billing_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"free" boolean DEFAULT false NOT NULL,
	"trial_ends_at" text NOT NULL,
	"paid_until" text,
	"plan" text,
	"subscription_id" text,
	"customer_id" text,
	"cancelled_at" text,
	"refunded_at" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "billing_accounts_subscription_id_unique" UNIQUE("subscription_id")
);
--> statement-breakpoint
CREATE TABLE "billing_checkouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"received_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "billing_accounts_customer" ON "billing_accounts" USING btree ("customer_id");--> statement-breakpoint
-- Escrito à mão: as contas que já existem quando a cobrança chega ficam grátis para sempre (decisão do proprietário, 27/10/2026).
INSERT INTO "billing_accounts" ("user_id","free","trial_ends_at","updated_at") SELECT "user_id",true,to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM "workspaces" ON CONFLICT ("user_id") DO NOTHING;
