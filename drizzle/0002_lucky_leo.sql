CREATE TABLE "calendar_feeds" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account" text DEFAULT '' NOT NULL,
	"events" text DEFAULT '[]' NOT NULL,
	"synced_at" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"error" text,
	"connected_at" text NOT NULL,
	CONSTRAINT "calendar_feeds_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
