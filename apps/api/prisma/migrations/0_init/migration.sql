

-- =====================================================================
-- Pre-launch MVP Initial Migration (PostgreSQL 18)
-- Fully matching docs/schema.sql and providing citext, CHECK constraints,
-- and partial indexes.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE "users" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "google_sub"    TEXT NOT NULL UNIQUE,
  "email"         CITEXT NOT NULL UNIQUE,
  "name"          TEXT NOT NULL CHECK (char_length("name") BETWEEN 1 AND 120),
  "avatar_url"    TEXT,
  "locale"        TEXT NOT NULL DEFAULT 'fr' CHECK ("locale" IN ('ar', 'fr', 'en')),
  "role"          TEXT NOT NULL DEFAULT 'user' CHECK ("role" IN ('user', 'admin')),
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_login_at" TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------
CREATE TABLE "sessions" (
  "id_hash"    BYTEA PRIMARY KEY,
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "user_agent" TEXT
);
CREATE INDEX "sessions_user_idx"    ON "sessions" ("user_id");
CREATE INDEX "sessions_expires_idx" ON "sessions" ("expires_at");

-- ---------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------
CREATE TABLE "campaigns" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "creator_id"       UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "slug"             TEXT NOT NULL UNIQUE
                     CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") <= 80),
  "title"            TEXT NOT NULL CHECK (char_length("title") BETWEEN 5 AND 120),
  "pitch"            TEXT NOT NULL CHECK (char_length("pitch") BETWEEN 10 AND 280),
  "category"         TEXT NOT NULL,
  "story"            JSONB NOT NULL CHECK (pg_column_size("story") < 100000),
  "goal_tnd"         INTEGER NOT NULL CHECK ("goal_tnd" > 0),
  "deadline"         TIMESTAMPTZ NOT NULL,
  "team_info"        TEXT CHECK (char_length("team_info") <= 2000),
  "links"            JSONB NOT NULL DEFAULT '[]'::jsonb
                     CHECK (jsonb_typeof("links") = 'array' AND jsonb_array_length("links") <= 5),
  "cover_image_key"  TEXT,
  "status"           TEXT NOT NULL DEFAULT 'draft'
                     CHECK ("status" IN ('draft', 'pending', 'approved', 'rejected', 'unpublished')),
  "rejection_reason" TEXT,
  "reviewed_by"      UUID REFERENCES "users"("id"),
  "reviewed_at"      TIMESTAMPTZ,
  "published_at"     TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "campaigns_public_idx"  ON "campaigns" ("published_at" DESC) WHERE "status" = 'approved';
CREATE INDEX "campaigns_pending_idx" ON "campaigns" ("created_at") WHERE "status" = 'pending';
CREATE INDEX "campaigns_creator_idx" ON "campaigns" ("creator_id", "created_at" DESC);

-- ---------------------------------------------------------------------
-- pledges
-- ---------------------------------------------------------------------
CREATE TABLE "pledges" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "campaign_id" UUID NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "pledges_user_id_campaign_id_key" UNIQUE ("user_id", "campaign_id")
);
CREATE INDEX "pledges_campaign_idx" ON "pledges" ("campaign_id");

-- ---------------------------------------------------------------------
-- ai_enhancement_jobs
-- ---------------------------------------------------------------------
CREATE TABLE "ai_enhancement_jobs" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "campaign_id"      UUID NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "status"           TEXT NOT NULL DEFAULT 'queued'
                     CHECK ("status" IN ('queued', 'processing', 'succeeded', 'failed')),
  "source_image_key" TEXT NOT NULL,
  "result_image_key" TEXT,
  "error"            TEXT,
  "accepted"         BOOLEAN NOT NULL DEFAULT false,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"     TIMESTAMPTZ
);
CREATE INDEX "ai_jobs_user_idx" ON "ai_enhancement_jobs" ("user_id", "created_at" DESC);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
CREATE TABLE "notifications" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"       TEXT NOT NULL,
  "payload"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dedupe_key" TEXT,
  "read_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "notifications_dedupe_idx" ON "notifications" ("user_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
CREATE INDEX "notifications_user_idx"   ON "notifications" ("user_id", "created_at" DESC);
CREATE INDEX "notifications_unread_idx" ON "notifications" ("user_id") WHERE "read_at" IS NULL;

-- ---------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------
CREATE TABLE "push_subscriptions" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint"   TEXT NOT NULL UNIQUE,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "push_user_idx" ON "push_subscriptions" ("user_id");

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
CREATE TABLE "events" (
  "id"          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "type"        TEXT NOT NULL,
  "user_id"     UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "campaign_id" UUID REFERENCES "campaigns"("id") ON DELETE SET NULL,
  "meta"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "events_type_time_idx" ON "events" ("type", "created_at" DESC);
CREATE INDEX "events_campaign_idx"  ON "events" ("campaign_id", "type");
