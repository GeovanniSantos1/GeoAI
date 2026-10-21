CREATE TABLE "board_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"at" text NOT NULL,
	"tool" text NOT NULL,
	"changes" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"area" text NOT NULL,
	"client_id" text,
	"due_date" text,
	"estimate" integer DEFAULT 0 NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"acceptance" text DEFAULT '[]' NOT NULL,
	"subtasks" text DEFAULT '[]' NOT NULL,
	"tests" text DEFAULT '[]' NOT NULL,
	"test_seq" integer DEFAULT 0 NOT NULL,
	"proposals" text DEFAULT '{}' NOT NULL,
	"rev" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"status_changed_at" text NOT NULL,
	CONSTRAINT "board_cards_user_number" UNIQUE("user_id","number")
);
--> statement-breakpoint
CREATE TABLE "board_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"at" text NOT NULL,
	"actor" text NOT NULL,
	"kind" text NOT NULL,
	"field" text,
	"before" text,
	"after" text
);
--> statement-breakpoint
CREATE TABLE "day_plans" (
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"data" text NOT NULL,
	CONSTRAINT "day_plans_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE INDEX "board_audit_user_at" ON "board_audit" USING btree ("user_id","at");--> statement-breakpoint
CREATE INDEX "board_cards_user_status" ON "board_cards" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "board_events_card_at" ON "board_events" USING btree ("card_id","at");--> statement-breakpoint
CREATE INDEX "board_events_user" ON "board_events" USING btree ("user_id");