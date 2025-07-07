CREATE TABLE IF NOT EXISTS "Reaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emojiId" uuid NOT NULL,
	"noteId" uuid NOT NULL,
	"authorId" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_emojiId_Emojis_id_fk" FOREIGN KEY ("emojiId") REFERENCES "public"."Emojis"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "public"."Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_authorId_Users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
