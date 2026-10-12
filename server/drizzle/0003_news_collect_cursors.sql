CREATE TABLE "news_collect_cursors" (
	"source" text PRIMARY KEY NOT NULL,
	"seen_through" timestamp with time zone NOT NULL,
	"resume_before" timestamp with time zone
);
