ALTER TABLE "Tokens" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Tokens" ADD COLUMN "expires_at" timestamp(3);