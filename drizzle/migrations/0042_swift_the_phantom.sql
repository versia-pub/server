CREATE TABLE "MediasToNote" (
	"mediaId" uuid NOT NULL,
	"noteId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Medias" DROP CONSTRAINT "Medias_noteId_Notes_id_fk";
--> statement-breakpoint
ALTER TABLE "Medias" ADD COLUMN "content" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Medias" ADD COLUMN "original_content" jsonb;--> statement-breakpoint
ALTER TABLE "Medias" ADD COLUMN "thumbnail" jsonb;--> statement-breakpoint
ALTER TABLE "MediasToNote" ADD CONSTRAINT "MediasToNote_mediaId_Medias_id_fk" FOREIGN KEY ("mediaId") REFERENCES "public"."Medias"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MediasToNote" ADD CONSTRAINT "MediasToNote_noteId_Notes_id_fk" FOREIGN KEY ("noteId") REFERENCES "public"."Notes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "MediasToNote_mediaId_index" ON "MediasToNote" USING btree ("mediaId");--> statement-breakpoint
CREATE INDEX "MediasToNote_noteId_index" ON "MediasToNote" USING btree ("noteId");--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "url";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "remote_url";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "thumbnail_url";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "mime_type";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "sha256";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "fps";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "duration";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "width";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "height";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "size";--> statement-breakpoint
ALTER TABLE "Medias" DROP COLUMN "noteId";
