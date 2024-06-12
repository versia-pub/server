CREATE TABLE IF NOT EXISTS "CaptchaChallenges" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"challenge" jsonb NOT NULL,
	"expires_at" timestamp(3) DEFAULT NOW() + INTERVAL '5 minutes',
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
