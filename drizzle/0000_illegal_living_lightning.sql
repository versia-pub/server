-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Emoji" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"shortcode" text NOT NULL,
	"url" text NOT NULL,
	"visible_in_picker" boolean NOT NULL,
	"instanceId" uuid,
	"alt" text,
	"content_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Like" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"likerId" uuid NOT NULL,
	"likedId" uuid NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "LysandObject" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"remote_id" text NOT NULL,
	"type" text NOT NULL,
	"uri" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"authorId" uuid,
	"extra_data" jsonb NOT NULL,
	"extensions" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Relationship" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"ownerId" uuid NOT NULL,
	"subjectId" uuid NOT NULL,
	"following" boolean NOT NULL,
	"showingReblogs" boolean NOT NULL,
	"notifying" boolean NOT NULL,
	"followedBy" boolean NOT NULL,
	"blocking" boolean NOT NULL,
	"blockedBy" boolean NOT NULL,
	"muting" boolean NOT NULL,
	"mutingNotifications" boolean NOT NULL,
	"requested" boolean NOT NULL,
	"domainBlocking" boolean NOT NULL,
	"endorsed" boolean NOT NULL,
	"languages" text[],
	"note" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Application" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"vapid_key" text,
	"client_id" text NOT NULL,
	"secret" text NOT NULL,
	"scopes" text NOT NULL,
	"redirect_uris" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Token" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"token_type" text NOT NULL,
	"scope" text NOT NULL,
	"access_token" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"userId" uuid,
	"applicationId" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_EmojiToUser" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_EmojiToStatus" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_StatusToUser" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_UserPinnedNotes" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Attachment" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"url" text NOT NULL,
	"remote_url" text,
	"thumbnail_url" text,
	"mime_type" text NOT NULL,
	"description" text,
	"blurhash" text,
	"sha256" text,
	"fps" integer,
	"duration" integer,
	"width" integer,
	"height" integer,
	"size" integer,
	"statusId" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Notification" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"type" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"notifiedId" uuid NOT NULL,
	"accountId" uuid NOT NULL,
	"statusId" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Status" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"uri" text,
	"authorId" uuid NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"reblogId" uuid,
	"content" text DEFAULT '' NOT NULL,
	"contentType" text DEFAULT 'text/plain' NOT NULL,
	"visibility" text NOT NULL,
	"inReplyToPostId" uuid,
	"quotingPostId" uuid,
	"instanceId" uuid,
	"sensitive" boolean NOT NULL,
	"spoilerText" text DEFAULT '' NOT NULL,
	"applicationId" uuid,
	"contentSource" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Instance" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"base_url" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"logo" jsonb NOT NULL,
	"disableAutomoderation" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "OpenIdAccount" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"userId" uuid,
	"serverId" text NOT NULL,
	"issuerId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"uri" text,
	"username" text NOT NULL,
	"displayName" text NOT NULL,
	"password" text,
	"email" text,
	"note" text DEFAULT '' NOT NULL,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"endpoints" jsonb,
	"source" jsonb NOT NULL,
	"avatar" text NOT NULL,
	"header" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"isBot" boolean DEFAULT false NOT NULL,
	"isLocked" boolean DEFAULT false NOT NULL,
	"isDiscoverable" boolean DEFAULT false NOT NULL,
	"sanctions" text[],
	"publicKey" text NOT NULL,
	"privateKey" text,
	"instanceId" uuid,
	"disableAutomoderation" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "OpenIdLoginFlow" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"codeVerifier" text NOT NULL,
	"applicationId" uuid,
	"issuerId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Flag" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"flagType" text DEFAULT 'other' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"flaggeStatusId" uuid,
	"flaggedUserId" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ModNote" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"notedStatusId" uuid,
	"notedUserId" uuid,
	"modId" uuid NOT NULL,
	"note" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ModTag" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"taggedStatusId" uuid,
	"taggedUserId" uuid,
	"modId" uuid NOT NULL,
	"tag" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "LysandObject_remote_id_key" ON "LysandObject" ("remote_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "LysandObject_uri_key" ON "LysandObject" ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Application_client_id_key" ON "Application" ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "_EmojiToUser_AB_unique" ON "_EmojiToUser" ("A","B");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "_EmojiToUser_B_index" ON "_EmojiToUser" ("B");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "_EmojiToStatus_AB_unique" ON "_EmojiToStatus" ("A","B");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "_EmojiToStatus_B_index" ON "_EmojiToStatus" ("B");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "_StatusToUser_AB_unique" ON "_StatusToUser" ("A","B");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "_StatusToUser_B_index" ON "_StatusToUser" ("B");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "_UserPinnedNotes_AB_unique" ON "_UserPinnedNotes" ("A","B");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "_UserPinnedNotes_B_index" ON "_UserPinnedNotes" ("B");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Status_uri_key" ON "Status" ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_uri_key" ON "User" ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User" ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Emoji" ADD CONSTRAINT "Emoji_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."Instance"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Like" ADD CONSTRAINT "Like_likerId_fkey" FOREIGN KEY ("likerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Like" ADD CONSTRAINT "Like_likedId_fkey" FOREIGN KEY ("likedId") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "LysandObject" ADD CONSTRAINT "LysandObject_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."LysandObject"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Token" ADD CONSTRAINT "Token_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."Application"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_EmojiToUser" ADD CONSTRAINT "_EmojiToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Emoji"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_EmojiToUser" ADD CONSTRAINT "_EmojiToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_EmojiToStatus" ADD CONSTRAINT "_EmojiToStatus_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Emoji"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_EmojiToStatus" ADD CONSTRAINT "_EmojiToStatus_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_StatusToUser" ADD CONSTRAINT "_StatusToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_StatusToUser" ADD CONSTRAINT "_StatusToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_UserPinnedNotes" ADD CONSTRAINT "_UserPinnedNotes_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_UserPinnedNotes" ADD CONSTRAINT "_UserPinnedNotes_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notification" ADD CONSTRAINT "Notification_notifiedId_fkey" FOREIGN KEY ("notifiedId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notification" ADD CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notification" ADD CONSTRAINT "Notification_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_reblogId_fkey" FOREIGN KEY ("reblogId") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_inReplyToPostId_fkey" FOREIGN KEY ("inReplyToPostId") REFERENCES "public"."Status"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_quotingPostId_fkey" FOREIGN KEY ("quotingPostId") REFERENCES "public"."Status"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."Instance"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."Application"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpenIdAccount" ADD CONSTRAINT "OpenIdAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."Instance"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpenIdLoginFlow" ADD CONSTRAINT "OpenIdLoginFlow_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."Application"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Flag" ADD CONSTRAINT "Flag_flaggeStatusId_fkey" FOREIGN KEY ("flaggeStatusId") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Flag" ADD CONSTRAINT "Flag_flaggedUserId_fkey" FOREIGN KEY ("flaggedUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_notedStatusId_fkey" FOREIGN KEY ("notedStatusId") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_notedUserId_fkey" FOREIGN KEY ("notedUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_modId_fkey" FOREIGN KEY ("modId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_taggedStatusId_fkey" FOREIGN KEY ("taggedStatusId") REFERENCES "public"."Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_taggedUserId_fkey" FOREIGN KEY ("taggedUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_modId_fkey" FOREIGN KEY ("modId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;