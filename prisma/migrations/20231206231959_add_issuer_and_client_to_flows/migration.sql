/*
  Warnings:

  - Added the required column `issuerId` to the `OpenIdLoginFlow` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OpenIdLoginFlow" ADD COLUMN     "applicationId" UUID,
ADD COLUMN     "issuerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "OpenIdLoginFlow" ADD CONSTRAINT "OpenIdLoginFlow_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
