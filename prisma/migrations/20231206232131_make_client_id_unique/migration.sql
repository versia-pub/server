/*
  Warnings:

  - A unique constraint covering the columns `[client_id]` on the table `Application` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Application_client_id_key" ON "Application"("client_id");
