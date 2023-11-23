-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "url" TEXT NOT NULL,
    "remote_url" TEXT,
    "thumbnail_url" TEXT,
    "mime_type" TEXT NOT NULL,
    "description" TEXT,
    "blurhash" TEXT,
    "sha256" TEXT,
    "fps" INTEGER,
    "duration" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "statusId" UUID,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;
