CREATE TYPE user_roles_enum AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

DROP TABLE "admin" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "updatedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_roles_enum" DEFAULT 'USER' NOT NULL;
