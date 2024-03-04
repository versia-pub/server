/*
  Warnings:

  - You are about to drop the column `statusId` on the `Flag` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Flag` table. All the data in the column will be lost.
  - You are about to drop the `ModerationData` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Flag" DROP CONSTRAINT "Flag_statusId_fkey";

-- DropForeignKey
ALTER TABLE "Flag" DROP CONSTRAINT "Flag_userId_fkey";

-- DropForeignKey
ALTER TABLE "ModerationData" DROP CONSTRAINT "ModerationData_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "ModerationData" DROP CONSTRAINT "ModerationData_statusId_fkey";

-- AlterTable
ALTER TABLE "Flag" DROP COLUMN "statusId",
DROP COLUMN "userId",
ADD COLUMN     "flaggeStatusId" UUID,
ADD COLUMN     "flaggedUserId" UUID;

-- DropTable
DROP TABLE "ModerationData";

-- CreateTable
CREATE TABLE "ModNote" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "notedStatusId" UUID,
    "notedUserId" UUID,
    "modId" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModTag" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "taggedStatusId" UUID,
    "taggedUserId" UUID,
    "modId" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModTag_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_notedStatusId_fkey" FOREIGN KEY ("notedStatusId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_notedUserId_fkey" FOREIGN KEY ("notedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModNote" ADD CONSTRAINT "ModNote_modId_fkey" FOREIGN KEY ("modId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_taggedStatusId_fkey" FOREIGN KEY ("taggedStatusId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_taggedUserId_fkey" FOREIGN KEY ("taggedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModTag" ADD CONSTRAINT "ModTag_modId_fkey" FOREIGN KEY ("modId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_flaggeStatusId_fkey" FOREIGN KEY ("flaggeStatusId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_flaggedUserId_fkey" FOREIGN KEY ("flaggedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
