CREATE TYPE "public"."exhibition_status" AS ENUM('upcoming', 'ongoing');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "exhibitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "exhibition_status" NOT NULL,
	"place_source" text,
	"place_id" text,
	"place_name" text NOT NULL,
	"summary" text NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "exhibitions_title_place_starts" ON "exhibitions" USING btree ("title","place_name","starts_on");--> statement-breakpoint
CREATE INDEX "exhibitions_place_idx" ON "exhibitions" USING btree ("place_source","place_id");--> statement-breakpoint
CREATE INDEX "exhibitions_ends_on_idx" ON "exhibitions" USING btree ("ends_on");--> statement-breakpoint
CREATE INDEX "exhibitions_status_idx" ON "exhibitions" USING btree ("status");