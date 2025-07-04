CREATE TABLE IF NOT EXISTS "Markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"noteId" uuid,
	"userId" uuid,
	"timeline" text NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Markers" ADD CONSTRAINT "Markers_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Markers" ADD CONSTRAINT "Markers_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
