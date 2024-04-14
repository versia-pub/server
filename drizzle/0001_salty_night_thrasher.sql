DROP TABLE "_prisma_migrations";--> statement-breakpoint
ALTER TABLE "Emoji" DROP CONSTRAINT "Emoji_instanceId_fkey";
--> statement-breakpoint
ALTER TABLE "Like" DROP CONSTRAINT "Like_likerId_fkey";
--> statement-breakpoint
ALTER TABLE "Like" DROP CONSTRAINT "Like_likedId_fkey";
--> statement-breakpoint
ALTER TABLE "LysandObject" DROP CONSTRAINT "LysandObject_authorId_fkey";
--> statement-breakpoint
ALTER TABLE "Relationship" DROP CONSTRAINT "Relationship_ownerId_fkey";
--> statement-breakpoint
ALTER TABLE "Relationship" DROP CONSTRAINT "Relationship_subjectId_fkey";
--> statement-breakpoint
ALTER TABLE "Token" DROP CONSTRAINT "Token_userId_fkey";
--> statement-breakpoint
ALTER TABLE "Token" DROP CONSTRAINT "Token_applicationId_fkey";
--> statement-breakpoint
ALTER TABLE "_EmojiToUser" DROP CONSTRAINT "_EmojiToUser_A_fkey";
--> statement-breakpoint
ALTER TABLE "_EmojiToUser" DROP CONSTRAINT "_EmojiToUser_B_fkey";
--> statement-breakpoint
ALTER TABLE "_EmojiToStatus" DROP CONSTRAINT "_EmojiToStatus_A_fkey";
--> statement-breakpoint
ALTER TABLE "_EmojiToStatus" DROP CONSTRAINT "_EmojiToStatus_B_fkey";
--> statement-breakpoint
ALTER TABLE "_StatusToUser" DROP CONSTRAINT "_StatusToUser_A_fkey";
--> statement-breakpoint
ALTER TABLE "_StatusToUser" DROP CONSTRAINT "_StatusToUser_B_fkey";
--> statement-breakpoint
ALTER TABLE "_UserPinnedNotes" DROP CONSTRAINT "_UserPinnedNotes_A_fkey";
--> statement-breakpoint
ALTER TABLE "_UserPinnedNotes" DROP CONSTRAINT "_UserPinnedNotes_B_fkey";
--> statement-breakpoint
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_statusId_fkey";
--> statement-breakpoint
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_notifiedId_fkey";
--> statement-breakpoint
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_accountId_fkey";
--> statement-breakpoint
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_statusId_fkey";
--> statement-breakpoint
ALTER TABLE "Status" DROP CONSTRAINT "Status_authorId_fkey";
--> statement-breakpoint
ALTER TABLE "Status" DROP CONSTRAINT "Status_instanceId_fkey";
--> statement-breakpoint
ALTER TABLE "Status" DROP CONSTRAINT "Status_applicationId_fkey";
--> statement-breakpoint
ALTER TABLE "Status" DROP CONSTRAINT "Status_reblogId_fkey";
--> statement-breakpoint
ALTER TABLE "OpenIdAccount" DROP CONSTRAINT "OpenIdAccount_userId_fkey";
--> statement-breakpoint
ALTER TABLE "User" DROP CONSTRAINT "User_instanceId_fkey";
--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlow" DROP CONSTRAINT "OpenIdLoginFlow_applicationId_fkey";
--> statement-breakpoint
ALTER TABLE "Flag" DROP CONSTRAINT "Flag_flaggeStatusId_fkey";
--> statement-breakpoint
ALTER TABLE "Flag" DROP CONSTRAINT "Flag_flaggedUserId_fkey";
--> statement-breakpoint
ALTER TABLE "ModNote" DROP CONSTRAINT "ModNote_notedStatusId_fkey";
--> statement-breakpoint
ALTER TABLE "ModNote" DROP CONSTRAINT "ModNote_notedUserId_fkey";
--> statement-breakpoint
ALTER TABLE "ModNote" DROP CONSTRAINT "ModNote_modId_fkey";
--> statement-breakpoint
ALTER TABLE "ModTag" DROP CONSTRAINT "ModTag_taggedStatusId_fkey";
--> statement-breakpoint
ALTER TABLE "ModTag" DROP CONSTRAINT "ModTag_taggedUserId_fkey";
--> statement-breakpoint
ALTER TABLE "ModTag" DROP CONSTRAINT "ModTag_modId_fkey";
--> statement-breakpoint
ALTER TABLE "Like" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "LysandObject" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "Relationship" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "Token" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "Notification" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "Status" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "sanctions" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Flag" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ModNote" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ModTag" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Emoji" ADD CONSTRAINT "Emoji_instanceId_Instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Like" ADD CONSTRAINT "Like_likerId_User_id_fk" FOREIGN KEY ("likerId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Like" ADD CONSTRAINT "Like_likedId_Status_id_fk" FOREIGN KEY ("likedId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "LysandObject" ADD CONSTRAINT "LysandObject_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "LysandObject"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_subjectId_User_id_fk" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Token" ADD CONSTRAINT "Token_applicationId_Application_id_fk" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_EmojiToUser" ADD CONSTRAINT "_EmojiToUser_A_Emoji_id_fk" FOREIGN KEY ("A") REFERENCES "Emoji"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_EmojiToUser" ADD CONSTRAINT "_EmojiToUser_B_User_id_fk" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_EmojiToStatus" ADD CONSTRAINT "_EmojiToStatus_A_Emoji_id_fk" FOREIGN KEY ("A") REFERENCES "Emoji"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_EmojiToStatus" ADD CONSTRAINT "_EmojiToStatus_B_Status_id_fk" FOREIGN KEY ("B") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_StatusToUser" ADD CONSTRAINT "_StatusToUser_A_Status_id_fk" FOREIGN KEY ("A") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_StatusToUser" ADD CONSTRAINT "_StatusToUser_B_User_id_fk" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_UserPinnedNotes" ADD CONSTRAINT "_UserPinnedNotes_A_Status_id_fk" FOREIGN KEY ("A") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "_UserPinnedNotes" ADD CONSTRAINT "_UserPinnedNotes_B_User_id_fk" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_statusId_Status_id_fk" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notification" ADD CONSTRAINT "Notification_notifiedId_User_id_fk" FOREIGN KEY ("notifiedId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notification" ADD CONSTRAINT "Notification_accountId_User_id_fk" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Notification" ADD CONSTRAINT "Notification_statusId_Status_id_fk" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_instanceId_Instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_applicationId_Application_id_fk" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_reblogId_fkey" FOREIGN KEY ("reblogId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpenIdAccount" ADD CONSTRAINT "OpenIdAccount_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_instanceId_Instance_id_fk" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpenIdLoginFlow" ADD CONSTRAINT "OpenIdLoginFlow_applicationId_Application_id_fk" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Flag" ADD CONSTRAINT "Flag_flaggeStatusId_Status_id_fk" FOREIGN KEY ("flaggeStatusId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Flag" ADD CONSTRAINT "Flag_flaggedUserId_User_id_fk" FOREIGN KEY ("flaggedUserId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_notedStatusId_Status_id_fk" FOREIGN KEY ("notedStatusId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_notedUserId_User_id_fk" FOREIGN KEY ("notedUserId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_modId_User_id_fk" FOREIGN KEY ("modId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_taggedStatusId_Status_id_fk" FOREIGN KEY ("taggedStatusId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_taggedUserId_User_id_fk" FOREIGN KEY ("taggedUserId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_modId_User_id_fk" FOREIGN KEY ("modId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
