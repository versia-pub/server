ALTER TABLE "Notes" DROP CONSTRAINT "Notes_replyId_Notes_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "Notes_uri_index";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notes" ADD CONSTRAINT "Notes_replyId_Notes_id_fk" FOREIGN KEY ("replyId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "Notes" ADD CONSTRAINT "Notes_uri_unique" UNIQUE("uri");