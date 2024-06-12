CREATE TABLE IF NOT EXISTS "RoleToUsers" (
	"roleId" uuid NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Roles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"permissions" text[] NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"description" text,
	"visible" boolean DEFAULT false NOT NULL,
	"icon" text
);
--> statement-breakpoint
DROP INDEX IF EXISTS "Applications_client_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "EmojiToNote_emojiId_noteId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "EmojiToNote_noteId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "EmojiToUser_emojiId_userId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "EmojiToUser_userId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "LysandObject_remote_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "LysandObject_uri_index";--> statement-breakpoint
DROP INDEX IF EXISTS "NoteToMentions_noteId_userId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "NoteToMentions_userId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "UserToPinnedNotes_userId_noteId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "UserToPinnedNotes_noteId_index";--> statement-breakpoint
DROP INDEX IF EXISTS "Users_uri_index";--> statement-breakpoint
DROP INDEX IF EXISTS "Users_username_index";--> statement-breakpoint
DROP INDEX IF EXISTS "Users_email_index";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RoleToUsers" ADD CONSTRAINT "RoleToUsers_roleId_Roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."Roles"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RoleToUsers" ADD CONSTRAINT "RoleToUsers_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Applications_client_id_index" ON "Applications" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "EmojiToNote_emojiId_noteId_index" ON "EmojiToNote" USING btree ("emojiId","noteId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "EmojiToNote_noteId_index" ON "EmojiToNote" USING btree ("noteId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "EmojiToUser_emojiId_userId_index" ON "EmojiToUser" USING btree ("emojiId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "EmojiToUser_userId_index" ON "EmojiToUser" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "LysandObject_remote_id_index" ON "LysandObject" USING btree ("remote_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "LysandObject_uri_index" ON "LysandObject" USING btree ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "NoteToMentions_noteId_userId_index" ON "NoteToMentions" USING btree ("noteId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "NoteToMentions_userId_index" ON "NoteToMentions" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UserToPinnedNotes_userId_noteId_index" ON "UserToPinnedNotes" USING btree ("userId","noteId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserToPinnedNotes_noteId_index" ON "UserToPinnedNotes" USING btree ("noteId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Users_uri_index" ON "Users" USING btree ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Users_username_index" ON "Users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_index" ON "Users" USING btree ("email");