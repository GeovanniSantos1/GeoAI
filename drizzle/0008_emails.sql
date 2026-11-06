CREATE TABLE "email_sends" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"sent_at" text NOT NULL,
	CONSTRAINT "email_sends_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
