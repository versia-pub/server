ALTER TABLE "UserToPinnedNotes" DROP CONSTRAINT "UserToPinnedNotes_userId_Notes_id_fk";
--> statement-breakpoint
ALTER TABLE "UserToPinnedNotes" DROP CONSTRAINT "UserToPinnedNotes_noteId_Users_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserToPinnedNotes" ADD CONSTRAINT "UserToPinnedNotes_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserToPinnedNotes" ADD CONSTRAINT "UserToPinnedNotes_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
