CREATE TABLE "whatsapp_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_links" (
	"jid" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"history" text DEFAULT '[]' NOT NULL,
	"pending" text DEFAULT '{}' NOT NULL,
	"choices" text DEFAULT '[]' NOT NULL,
	"recent_ids" text DEFAULT '[]' NOT NULL,
	"linked_at" text NOT NULL,
	CONSTRAINT "whatsapp_links_user_id_unique" UNIQUE("user_id")
);
