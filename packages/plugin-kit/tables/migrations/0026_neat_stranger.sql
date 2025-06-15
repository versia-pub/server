CREATE TABLE IF NOT EXISTS "CaptchaChallenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge" jsonb NOT NULL,
	"expires_at" timestamp(3) DEFAULT NOW() + INTERVAL '5 minutes',
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
