ALTER TABLE "Emojis" ADD COLUMN "ownerId" uuid;--> statement-breakpoint
ALTER TABLE "Emojis" ADD COLUMN "category" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Emojis" ADD CONSTRAINT "Emojis_ownerId_Users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
