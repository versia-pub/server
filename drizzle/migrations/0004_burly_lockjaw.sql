ALTER TABLE "_EmojiToStatus" RENAME TO "EmojiToStatus";--> statement-breakpoint
ALTER TABLE "_UserPinnedNotes" RENAME TO "UserToPinnedNotes";--> statement-breakpoint
ALTER TABLE "EmojiToStatus" RENAME COLUMN "A" TO "emojiId";--> statement-breakpoint
ALTER TABLE "EmojiToStatus" RENAME COLUMN "B" TO "statusId";--> statement-breakpoint
ALTER TABLE "UserToPinnedNotes" RENAME COLUMN "A" TO "userId";--> statement-breakpoint
ALTER TABLE "UserToPinnedNotes" RENAME COLUMN "B" TO "statusId";--> statement-breakpoint
ALTER TABLE "LysandObject" DROP CONSTRAINT "LysandObject_authorId_fkey";
--> statement-breakpoint
ALTER TABLE "EmojiToStatus" DROP CONSTRAINT "_EmojiToStatus_A_Emoji_id_fk";
--> statement-breakpoint
ALTER TABLE "EmojiToStatus" DROP CONSTRAINT "_EmojiToStatus_B_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "UserToPinnedNotes" DROP CONSTRAINT "_UserPinnedNotes_A_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "UserToPinnedNotes" DROP CONSTRAINT "_UserPinnedNotes_B_User_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "LysandObject_remote_id_key";--> statement-breakpoint
DROP INDEX IF EXISTS "LysandObject_uri_key";--> statement-breakpoint
DROP INDEX IF EXISTS "_EmojiToStatus_AB_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "_EmojiToStatus_B_index";--> statement-breakpoint
DROP INDEX IF EXISTS "_UserPinnedNotes_AB_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "_UserPinnedNotes_B_index";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "LysandObject_remote_id_index" ON "LysandObject" ("remote_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "LysandObject_uri_index" ON "LysandObject" ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "EmojiToStatus_emojiId_statusId_index" ON "EmojiToStatus" ("emojiId","statusId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "EmojiToStatus_statusId_index" ON "EmojiToStatus" ("statusId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UserToPinnedNotes_userId_statusId_index" ON "UserToPinnedNotes" ("userId","statusId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserToPinnedNotes_statusId_index" ON "UserToPinnedNotes" ("statusId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "LysandObject" ADD CONSTRAINT "LysandObject_authorId_LysandObject_id_fk" FOREIGN KEY ("authorId") REFERENCES "LysandObject"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EmojiToStatus" ADD CONSTRAINT "EmojiToStatus_emojiId_Emoji_id_fk" FOREIGN KEY ("emojiId") REFERENCES "Emoji"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EmojiToStatus" ADD CONSTRAINT "EmojiToStatus_statusId_Status_id_fk" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserToPinnedNotes" ADD CONSTRAINT "UserToPinnedNotes_userId_Status_id_fk" FOREIGN KEY ("userId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserToPinnedNotes" ADD CONSTRAINT "UserToPinnedNotes_statusId_User_id_fk" FOREIGN KEY ("statusId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
