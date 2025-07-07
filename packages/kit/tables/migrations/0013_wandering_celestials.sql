ALTER TABLE "Markers" ALTER COLUMN "userId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Markers" ADD COLUMN "notificationId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Markers" ADD CONSTRAINT "Markers_notificationId_Notifications_id_fk" FOREIGN KEY ("notificationId") REFERENCES "Notifications"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
