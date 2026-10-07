DROP INDEX "exhibitions_title_place_starts";--> statement-breakpoint
ALTER TABLE "exhibitions" ALTER COLUMN "starts_on" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exhibitions_title_place_ends_no_start" ON "exhibitions" USING btree ("title","place_name","ends_on") WHERE "exhibitions"."starts_on" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exhibitions_title_place_starts" ON "exhibitions" USING btree ("title","place_name","starts_on") WHERE "exhibitions"."starts_on" is not null;