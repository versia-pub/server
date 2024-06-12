ALTER TABLE "Application" RENAME TO "Applications";--> statement-breakpoint
ALTER TABLE "Attachment" RENAME TO "Attachments";--> statement-breakpoint
ALTER TABLE "Emoji" RENAME TO "Emojis";--> statement-breakpoint
ALTER TABLE "EmojiToStatus" RENAME TO "EmojiToNote";--> statement-breakpoint
ALTER TABLE "Flag" RENAME TO "Flags";--> statement-breakpoint
ALTER TABLE "Instance" RENAME TO "Instances";--> statement-breakpoint
ALTER TABLE "Like" RENAME TO "Likes";--> statement-breakpoint
ALTER TABLE "ModNote" RENAME TO "ModNotes";--> statement-breakpoint
ALTER TABLE "ModTag" RENAME TO "ModTags";--> statement-breakpoint
ALTER TABLE "Notification" RENAME TO "Notifications";--> statement-breakpoint
ALTER TABLE "OpenIdAccount" RENAME TO "OpenIdAccounts";--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlow" RENAME TO "OpenIdLoginFlows";--> statement-breakpoint
ALTER TABLE "Relationship" RENAME TO "Relationships";--> statement-breakpoint
ALTER TABLE "Status" RENAME TO "Notes";--> statement-breakpoint
ALTER TABLE "StatusToMentions" RENAME TO "NoteToMentions";--> statement-breakpoint
ALTER TABLE "Token" RENAME TO "Tokens";--> statement-breakpoint
ALTER TABLE "User" RENAME TO "Users";--> statement-breakpoint
ALTER TABLE "UserToPinnedNotes" RENAME COLUMN "statusId" TO "noteId";--> statement-breakpoint
ALTER TABLE "Attachments" RENAME COLUMN "statusId" TO "noteId";--> statement-breakpoint
ALTER TABLE "EmojiToNote" RENAME COLUMN "statusId" TO "noteId";--> statement-breakpoint
ALTER TABLE "Flags" RENAME COLUMN "flaggeStatusId" TO "noteId";--> statement-breakpoint
ALTER TABLE "Flags" RENAME COLUMN "flaggedUserId" TO "userId";--> statement-breakpoint
ALTER TABLE "ModNotes" RENAME COLUMN "notedStatusId" TO "noteId";--> statement-breakpoint
ALTER TABLE "ModNotes" RENAME COLUMN "notedUserId" TO "userId";--> statement-breakpoint
ALTER TABLE "ModTags" RENAME COLUMN "taggedStatusId" TO "statusId";--> statement-breakpoint
ALTER TABLE "ModTags" RENAME COLUMN "taggedUserId" TO "userId";--> statement-breakpoint
ALTER TABLE "Notifications" RENAME COLUMN "statusId" TO "noteId";--> statement-breakpoint
ALTER TABLE "Notes" RENAME COLUMN "inReplyToPostId" TO "replyId";--> statement-breakpoint
ALTER TABLE "Notes" RENAME COLUMN "quotingPostId" TO "quoteId";--> statement-breakpoint
ALTER TABLE "NoteToMentions" RENAME COLUMN "statusId" TO "noteId";--> statement-breakpoint
ALTER TABLE "EmojiToUser" DROP CONSTRAINT "EmojiToUser_emojiId_Emoji_id_fk";
--> statement-breakpoint
ALTER TABLE "EmojiToUser" DROP CONSTRAINT "EmojiToUser_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "UserToPinnedNotes" DROP CONSTRAINT "UserToPinnedNotes_userId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "UserToPinnedNotes" DROP CONSTRAINT "UserToPinnedNotes_statusId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Attachments" DROP CONSTRAINT "Attachment_statusId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "Emojis" DROP CONSTRAINT "Emoji_instanceId_Instance_id_fk";
--> statement-breakpoint
ALTER TABLE "EmojiToNote" DROP CONSTRAINT "EmojiToStatus_emojiId_Emoji_id_fk";
--> statement-breakpoint
ALTER TABLE "EmojiToNote" DROP CONSTRAINT "EmojiToStatus_statusId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "Flags" DROP CONSTRAINT "Flag_flaggeStatusId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "Flags" DROP CONSTRAINT "Flag_flaggedUserId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Likes" DROP CONSTRAINT "Like_likerId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Likes" DROP CONSTRAINT "Like_likedId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "ModNotes" DROP CONSTRAINT "ModNote_notedStatusId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "ModNotes" DROP CONSTRAINT "ModNote_notedUserId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "ModNotes" DROP CONSTRAINT "ModNote_modId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "ModTags" DROP CONSTRAINT "ModTag_taggedStatusId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "ModTags" DROP CONSTRAINT "ModTag_taggedUserId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "ModTags" DROP CONSTRAINT "ModTag_modId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Notifications" DROP CONSTRAINT "Notification_notifiedId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Notifications" DROP CONSTRAINT "Notification_accountId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Notifications" DROP CONSTRAINT "Notification_statusId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "OpenIdAccounts" DROP CONSTRAINT "OpenIdAccount_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" DROP CONSTRAINT "OpenIdLoginFlow_applicationId_Application_id_fk";
--> statement-breakpoint
ALTER TABLE "Relationships" DROP CONSTRAINT "Relationship_ownerId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Relationships" DROP CONSTRAINT "Relationship_subjectId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Notes" DROP CONSTRAINT "Status_authorId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Notes" DROP CONSTRAINT "Status_applicationId_Application_id_fk";
--> statement-breakpoint
ALTER TABLE "Notes" DROP CONSTRAINT "Status_reblogId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "Notes" DROP CONSTRAINT "Status_inReplyToPostId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "Notes" DROP CONSTRAINT "Status_quotingPostId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "NoteToMentions" DROP CONSTRAINT "StatusToMentions_statusId_Status_id_fk";
--> statement-breakpoint
ALTER TABLE "NoteToMentions" DROP CONSTRAINT "StatusToMentions_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Tokens" DROP CONSTRAINT "Token_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Tokens" DROP CONSTRAINT "Token_applicationId_Application_id_fk";
--> statement-breakpoint
ALTER TABLE "Users" DROP CONSTRAINT "User_instanceId_Instance_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "UserToPinnedNotes_userId_statusId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "UserToPinnedNotes_statusId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "Application_client_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "EmojiToStatus_emojiId_statusId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "EmojiToStatus_statusId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "Status_uri_index";--> statement-breakpoint
DROP INDEX IF EXISTS "StatusToMentions_statusId_userId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "StatusToMentions_userId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "User_uri_index";--> statement-breakpoint
DROP INDEX IF EXISTS "User_username_index";--> statement-breakpoint
DROP INDEX IF EXISTS "User_email_index";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UserToPinnedNotes_userId_noteId_index" ON "UserToPinnedNotes" ("userId","noteId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserToPinnedNotes_noteId_index" ON "UserToPinnedNotes" ("noteId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Applications_client_id_index" ON "Applications" ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "EmojiToNote_emojiId_noteId_index" ON "EmojiToNote" ("emojiId","noteId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "EmojiToNote_noteId_index" ON "EmojiToNote" ("noteId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Notes_uri_index" ON "Notes" ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "NoteToMentions_noteId_userId_index" ON "NoteToMentions" ("noteId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "NoteToMentions_userId_index" ON "NoteToMentions" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Users_uri_index" ON "Users" ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Users_username_index" ON "Users" ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_index" ON "Users" ("email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EmojiToUser" ADD CONSTRAINT "EmojiToUser_emojiId_Emojis_id_fk" FOREIGN KEY ("emojiId") REFERENCES "Emojis"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EmojiToUser" ADD CONSTRAINT "EmojiToUser_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserToPinnedNotes" ADD CONSTRAINT "UserToPinnedNotes_userId_Notes_id_fk" FOREIGN KEY ("userId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserToPinnedNotes" ADD CONSTRAINT "UserToPinnedNotes_noteId_Users_id_fk" FOREIGN KEY ("noteId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Attachments" ADD CONSTRAINT "Attachments_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Emojis" ADD CONSTRAINT "Emojis_instanceId_Instances_id_fk" FOREIGN KEY ("instanceId") REFERENCES "Instances"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EmojiToNote" ADD CONSTRAINT "EmojiToNote_emojiId_Emojis_id_fk" FOREIGN KEY ("emojiId") REFERENCES "Emojis"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EmojiToNote" ADD CONSTRAINT "EmojiToNote_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Flags" ADD CONSTRAINT "Flags_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Flags" ADD CONSTRAINT "Flags_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Likes" ADD CONSTRAINT "Likes_likerId_Users_id_fk" FOREIGN KEY ("likerId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Likes" ADD CONSTRAINT "Likes_likedId_Notes_id_fk" FOREIGN KEY ("likedId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNotes" ADD CONSTRAINT "ModNotes_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNotes" ADD CONSTRAINT "ModNotes_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNotes" ADD CONSTRAINT "ModNotes_modId_Users_id_fk" FOREIGN KEY ("modId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTags" ADD CONSTRAINT "ModTags_statusId_Notes_id_fk" FOREIGN KEY ("statusId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTags" ADD CONSTRAINT "ModTags_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTags" ADD CONSTRAINT "ModTags_modId_Users_id_fk" FOREIGN KEY ("modId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_notifiedId_Users_id_fk" FOREIGN KEY ("notifiedId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_accountId_Users_id_fk" FOREIGN KEY ("accountId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpenIdAccounts" ADD CONSTRAINT "OpenIdAccounts_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpenIdLoginFlows" ADD CONSTRAINT "OpenIdLoginFlows_applicationId_Applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "Applications"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Relationships" ADD CONSTRAINT "Relationships_ownerId_Users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Relationships" ADD CONSTRAINT "Relationships_subjectId_Users_id_fk" FOREIGN KEY ("subjectId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notes" ADD CONSTRAINT "Notes_authorId_Users_id_fk" FOREIGN KEY ("authorId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notes" ADD CONSTRAINT "Notes_applicationId_Applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "Applications"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notes" ADD CONSTRAINT "Notes_reblogId_Notes_id_fk" FOREIGN KEY ("reblogId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notes" ADD CONSTRAINT "Notes_replyId_Notes_id_fk" FOREIGN KEY ("replyId") REFERENCES "Notes"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notes" ADD CONSTRAINT "Notes_quoteId_Notes_id_fk" FOREIGN KEY ("quoteId") REFERENCES "Notes"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NoteToMentions" ADD CONSTRAINT "NoteToMentions_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "Notes"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NoteToMentions" ADD CONSTRAINT "NoteToMentions_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Tokens" ADD CONSTRAINT "Tokens_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Tokens" ADD CONSTRAINT "Tokens_applicationId_Applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "Applications"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Users" ADD CONSTRAINT "Users_instanceId_Instances_id_fk" FOREIGN KEY ("instanceId") REFERENCES "Instances"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
