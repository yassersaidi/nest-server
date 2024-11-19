ALTER TABLE "session" DROP CONSTRAINT "session_refresh_token_unique";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_id_idx" ON "session" USING btree ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_idx" ON "user" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "username_idx" ON "user" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "codeIdx" ON "verification_code" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "userIdIdx" ON "verification_code" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expiresAtIdx" ON "verification_code" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "typeIdx" ON "verification_code" USING btree ("type");--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN IF EXISTS "refresh_token";