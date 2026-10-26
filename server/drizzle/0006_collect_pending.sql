CREATE TABLE "collect_pending" (
	"source" text NOT NULL,
	"post_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"published_on" date NOT NULL,
	CONSTRAINT "collect_pending_source_post_id_pk" PRIMARY KEY("source","post_id")
);
