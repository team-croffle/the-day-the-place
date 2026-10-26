DROP TABLE "news_collect_cursors";
--> statement-breakpoint
CREATE TABLE "collect_cursors" (
	"source" text PRIMARY KEY NOT NULL,
	"last_post_id" integer NOT NULL
);
