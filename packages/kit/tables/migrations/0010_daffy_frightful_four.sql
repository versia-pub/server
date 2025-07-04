ALTER TABLE "ModTags" RENAME COLUMN "statusId" TO "noteId";--> statement-breakpoint
ALTER TABLE "ModTags" DROP CONSTRAINT "ModTags_statusId_Notes_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTags" ADD CONSTRAINT "ModTags_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
