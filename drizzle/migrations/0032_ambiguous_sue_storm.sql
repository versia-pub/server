ALTER TABLE "LysandObject" RENAME TO "VersiaObject";--> statement-breakpoint
ALTER TABLE "VersiaObject" DROP CONSTRAINT "LysandObject_authorId_LysandObject_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "LysandObject_remote_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "LysandObject_uri_index";--> statement-breakpoint
ALTER TABLE "Instances" ALTER COLUMN "protocol" SET DEFAULT 'versia';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VersiaObject" ADD CONSTRAINT "VersiaObject_authorId_VersiaObject_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."VersiaObject"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "VersiaObject_remote_id_index" ON "VersiaObject" USING btree ("remote_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "VersiaObject_uri_index" ON "VersiaObject" USING btree ("uri");