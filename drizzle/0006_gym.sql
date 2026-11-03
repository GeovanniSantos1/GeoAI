CREATE TABLE "gym_active" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"rev" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"rev" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_workouts" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"date" text NOT NULL,
	"started_at" text NOT NULL,
	"duration_min" integer DEFAULT 0 NOT NULL,
	"routine_id" text,
	"name" text NOT NULL,
	"volume" integer DEFAULT 0 NOT NULL,
	"sets_done" integer DEFAULT 0 NOT NULL,
	"prs" integer DEFAULT 0 NOT NULL,
	"data" text NOT NULL,
	"rev" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "gym_workouts_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE INDEX "gym_workouts_user_date" ON "gym_workouts" USING btree ("user_id","date","started_at");