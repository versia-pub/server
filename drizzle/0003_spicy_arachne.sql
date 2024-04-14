ALTER TABLE "StatusToMentions" RENAME COLUMN "A" TO "statusId";--> statement-breakpoint
ALTER TABLE "StatusToMentions" RENAME COLUMN "B" TO "userId";--> statement-breakpoint
ALTER TABLE "StatusToMentions" DROP CONSTRAINT "StatusToMentions_A_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "StatusToMentions" DROP CONSTRAINT "StatusToMentions_B_User_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "StatusToMentions_A_B_index";--> statement-breakpoint
DROP INDEX IF EXISTS "StatusToMentions_B_index";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "StatusToMentions_statusId_userId_index" ON "StatusToMentions" ("statusId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "StatusToMentions_userId_index" ON "StatusToMentions" ("userId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "StatusToMentions" ADD CONSTRAINT "StatusToMentions_statusId_Status_id_fk" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "StatusToMentions" ADD CONSTRAINT "StatusToMentions_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
