ALTER TABLE "Attachments" RENAME TO "Medias";--> statement-breakpoint
ALTER TABLE "Medias" DROP CONSTRAINT "Attachments_noteId_Notes_id_fk";
--> statement-breakpoint
ALTER TABLE "Medias" ADD CONSTRAINT "Medias_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "public"."Notes"("id") ON DELETE cascade ON UPDATE cascade;