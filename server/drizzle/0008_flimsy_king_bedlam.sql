CREATE TYPE "public"."place_kind" AS ENUM('museum', 'site');--> statement-breakpoint
CREATE TYPE "public"."place_source" AS ENUM('tour', 'heritage');--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "place_source" NOT NULL,
	"place_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "place_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_source_place" ON "favorites" USING btree ("user_id","source","place_id");--> statement-breakpoint
CREATE INDEX "favorites_source_place_idx" ON "favorites" USING btree ("source","place_id");