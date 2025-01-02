CREATE TABLE "PushSubscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"endpoint" text NOT NULL,
	"public_key" text NOT NULL,
	"auth_secret" text NOT NULL,
	"alerts" jsonb NOT NULL,
	"policy" text NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"tokenId" uuid NOT NULL,
	CONSTRAINT "PushSubscriptions_tokenId_unique" UNIQUE("tokenId")
);
--> statement-breakpoint
ALTER TABLE "PushSubscriptions" ADD CONSTRAINT "PushSubscriptions_tokenId_Tokens_id_fk" FOREIGN KEY ("tokenId") REFERENCES "public"."Tokens"("id") ON DELETE cascade ON UPDATE cascade;