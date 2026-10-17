CREATE TABLE "usage_counters" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counters_user_id_kind_day_pk" PRIMARY KEY("user_id","kind","day")
);
