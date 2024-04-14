ALTER TABLE "_EmojiToUser" RENAME TO "EmojiToUser";--> statement-breakpoint
ALTER TABLE "Flag" RENAME COLUMN "flagType" TO "flag_type";--> statement-breakpoint
ALTER TABLE "Flag" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "ModNote" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "ModTag" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "OpenIdAccount" RENAME COLUMN "serverId" TO "server_id";--> statement-breakpoint
ALTER TABLE "OpenIdAccount" RENAME COLUMN "issuerId" TO "issuer_id";--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlow" RENAME COLUMN "codeVerifier" TO "code_verifier";--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlow" RENAME COLUMN "issuerId" TO "issuer_id";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "displayName" TO "display_name";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "isAdmin" TO "is_admin";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "isBot" TO "is_bot";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "isLocked" TO "is_locked";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "isDiscoverable" TO "is_discoverable";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "publicKey" TO "public_key";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "privateKey" TO "private_key";--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "disableAutomoderation" TO "disable_automoderation";--> statement-breakpoint
ALTER TABLE "EmojiToUser" RENAME COLUMN "A" TO "emojiId";--> statement-breakpoint
ALTER TABLE "EmojiToUser" RENAME COLUMN "B" TO "userId";--> statement-breakpoint
ALTER TABLE "EmojiToUser" DROP CONSTRAINT "_EmojiToUser_A_Emoji_id_fk";
--> statement-breakpoint
ALTER TABLE "EmojiToUser" DROP CONSTRAINT "_EmojiToUser_B_User_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "User_uri_key";--> statement-breakpoint
DROP INDEX IF EXISTS "User_username_key";--> statement-breakpoint
DROP INDEX IF EXISTS "User_email_key";--> statement-breakpoint
DROP INDEX IF EXISTS "_EmojiToUser_AB_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "_EmojiToUser_B_index";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_uri_index" ON "User" ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_index" ON "User" ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_index" ON "User" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "EmojiToUser_emojiId_userId_index" ON "EmojiToUser" ("emojiId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "EmojiToUser_userId_index" ON "EmojiToUser" ("userId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EmojiToUser" ADD CONSTRAINT "EmojiToUser_emojiId_Emoji_id_fk" FOREIGN KEY ("emojiId") REFERENCES "Emoji"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EmojiToUser" ADD CONSTRAINT "EmojiToUser_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
