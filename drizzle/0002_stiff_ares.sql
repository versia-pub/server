ALTER TABLE "_StatusToUser" RENAME TO "StatusToMentions";--> statement-breakpoint
ALTER TABLE "StatusToMentions" DROP CONSTRAINT "_StatusToUser_A_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "StatusToMentions" DROP CONSTRAINT "_StatusToUser_B_User_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "_StatusToUser_AB_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "_StatusToUser_B_index";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "StatusToMentions_A_B_index" ON "StatusToMentions" ("A","B");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "StatusToMentions_B_index" ON "StatusToMentions" ("B");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "StatusToMentions" ADD CONSTRAINT "StatusToMentions_A_Status_id_fk" FOREIGN KEY ("A") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "StatusToMentions" ADD CONSTRAINT "StatusToMentions_B_User_id_fk" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
