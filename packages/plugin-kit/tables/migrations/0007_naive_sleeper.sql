ALTER TABLE "Status" DROP CONSTRAINT "Status_instanceId_Instance_id_fk";
--> statement-breakpoint
ALTER TABLE "Status" DROP COLUMN IF EXISTS "instanceId";