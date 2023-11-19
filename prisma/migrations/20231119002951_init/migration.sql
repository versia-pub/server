-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_uuidv7";

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "name" TEXT NOT NULL,
    "website" TEXT,
    "vapid_key" TEXT,
    "client_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "redirect_uris" TEXT NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emoji" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "shortcode" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visible_in_picker" BOOLEAN NOT NULL,
    "instanceId" UUID,
    "alt" TEXT,
    "content_type" TEXT NOT NULL,

    CONSTRAINT "Emoji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "base_url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "logo" JSONB NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Like" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "likerId" UUID NOT NULL,
    "likedId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LysandObject" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "remote_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" UUID,
    "extra_data" JSONB NOT NULL,
    "extensions" JSONB NOT NULL,

    CONSTRAINT "LysandObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "ownerId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "following" BOOLEAN NOT NULL,
    "showingReblogs" BOOLEAN NOT NULL,
    "notifying" BOOLEAN NOT NULL,
    "followedBy" BOOLEAN NOT NULL,
    "blocking" BOOLEAN NOT NULL,
    "blockedBy" BOOLEAN NOT NULL,
    "muting" BOOLEAN NOT NULL,
    "mutingNotifications" BOOLEAN NOT NULL,
    "requested" BOOLEAN NOT NULL,
    "domainBlocking" BOOLEAN NOT NULL,
    "endorsed" BOOLEAN NOT NULL,
    "languages" TEXT[],
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Status" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "uri" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reblogId" UUID,
    "isReblog" BOOLEAN NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "contentType" TEXT NOT NULL DEFAULT 'text/plain',
    "visibility" TEXT NOT NULL,
    "inReplyToPostId" UUID,
    "quotingPostId" UUID,
    "instanceId" UUID,
    "sensitive" BOOLEAN NOT NULL,
    "spoilerText" TEXT NOT NULL DEFAULT '',
    "applicationId" UUID,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "token_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,
    "applicationId" UUID,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "uri" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "password" TEXT,
    "email" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "endpoints" JSONB,
    "source" JSONB NOT NULL,
    "avatar" TEXT NOT NULL,
    "header" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isDiscoverable" BOOLEAN NOT NULL DEFAULT false,
    "sanctions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT,
    "instanceId" UUID,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EmojiToUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateTable
CREATE TABLE "_EmojiToStatus" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateTable
CREATE TABLE "_StatusToUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateTable
CREATE TABLE "_UserPinnedNotes" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LysandObject_remote_id_key" ON "LysandObject"("remote_id");

-- CreateIndex
CREATE UNIQUE INDEX "LysandObject_uri_key" ON "LysandObject"("uri");

-- CreateIndex
CREATE UNIQUE INDEX "Status_uri_key" ON "Status"("uri");

-- CreateIndex
CREATE UNIQUE INDEX "User_uri_key" ON "User"("uri");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_EmojiToUser_AB_unique" ON "_EmojiToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_EmojiToUser_B_index" ON "_EmojiToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_EmojiToStatus_AB_unique" ON "_EmojiToStatus"("A", "B");

-- CreateIndex
CREATE INDEX "_EmojiToStatus_B_index" ON "_EmojiToStatus"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_StatusToUser_AB_unique" ON "_StatusToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_StatusToUser_B_index" ON "_StatusToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_UserPinnedNotes_AB_unique" ON "_UserPinnedNotes"("A", "B");

-- CreateIndex
CREATE INDEX "_UserPinnedNotes_B_index" ON "_UserPinnedNotes"("B");

-- AddForeignKey
ALTER TABLE "Emoji" ADD CONSTRAINT "Emoji_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_likerId_fkey" FOREIGN KEY ("likerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_likedId_fkey" FOREIGN KEY ("likedId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LysandObject" ADD CONSTRAINT "LysandObject_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "LysandObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_reblogId_fkey" FOREIGN KEY ("reblogId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_inReplyToPostId_fkey" FOREIGN KEY ("inReplyToPostId") REFERENCES "Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_quotingPostId_fkey" FOREIGN KEY ("quotingPostId") REFERENCES "Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmojiToUser" ADD CONSTRAINT "_EmojiToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Emoji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmojiToUser" ADD CONSTRAINT "_EmojiToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmojiToStatus" ADD CONSTRAINT "_EmojiToStatus_A_fkey" FOREIGN KEY ("A") REFERENCES "Emoji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmojiToStatus" ADD CONSTRAINT "_EmojiToStatus_B_fkey" FOREIGN KEY ("B") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StatusToUser" ADD CONSTRAINT "_StatusToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StatusToUser" ADD CONSTRAINT "_StatusToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserPinnedNotes" ADD CONSTRAINT "_UserPinnedNotes_A_fkey" FOREIGN KEY ("A") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserPinnedNotes" ADD CONSTRAINT "_UserPinnedNotes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
