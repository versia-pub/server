ALTER TABLE "Users" ADD COLUMN "avatarId" uuid;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "headerId" uuid;--> statement-breakpoint
ALTER TABLE "Users" ADD CONSTRAINT "Users_avatarId_Medias_id_fk" FOREIGN KEY ("avatarId") REFERENCES "public"."Medias"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Users" ADD CONSTRAINT "Users_headerId_Medias_id_fk" FOREIGN KEY ("headerId") REFERENCES "public"."Medias"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Users" DROP COLUMN "avatar";--> statement-breakpoint
ALTER TABLE "Users" DROP COLUMN "header";