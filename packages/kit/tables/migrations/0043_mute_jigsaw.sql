ALTER TABLE "Emojis" ADD COLUMN "mediaId" uuid;--> statement-breakpoint
ALTER TABLE "Emojis" ADD CONSTRAINT "Emojis_mediaId_Medias_id_fk" FOREIGN KEY ("mediaId") REFERENCES "public"."Medias"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Emojis" DROP COLUMN "url";--> statement-breakpoint
ALTER TABLE "Emojis" DROP COLUMN "alt";--> statement-breakpoint
ALTER TABLE "Emojis" DROP COLUMN "content_type";