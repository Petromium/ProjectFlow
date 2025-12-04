ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_system_admin" boolean DEFAULT false;

DROP TABLE IF EXISTS "organization_subscriptions" CASCADE;
DROP TABLE IF EXISTS "subscription_plans" CASCADE;
DROP TABLE IF EXISTS "ai_usage_summary" CASCADE;
DROP TABLE IF EXISTS "cloud_synced_files" CASCADE;
DROP TABLE IF EXISTS "cloud_storage_connections" CASCADE;
-- Don't drop push_subscriptions if it might have data, but here we assume it's new or empty enough for dev
DROP TABLE IF EXISTS "push_subscriptions" CASCADE;

CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" serial PRIMARY KEY NOT NULL,
  "tier" varchar(50) NOT NULL UNIQUE,
  "name" varchar(100) NOT NULL,
  "price_monthly" integer,
  "price_yearly" integer,
  "currency" varchar(3) DEFAULT 'USD',
  "storage_quota_bytes" bigint,
  "ai_token_limit" integer,
  "project_limit" integer,
  "user_limit" integer,
  "features" jsonb,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "organization_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "plan_id" integer NOT NULL REFERENCES "subscription_plans"("id"),
  "status" varchar(50) DEFAULT 'active',
  "start_date" timestamp DEFAULT now(),
  "end_date" timestamp,
  "auto_renew" boolean DEFAULT true,
  "payment_method_id" varchar(100),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_usage_summary" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "month" varchar(7) NOT NULL,
  "tokens_used" integer DEFAULT 0 NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "token_limit" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ai_usage_org_month_unique" UNIQUE("organization_id", "month")
);

CREATE TABLE IF NOT EXISTS "cloud_storage_connections" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "provider" varchar(50) NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "token_expires_at" timestamp,
  "sync_status" varchar(50) DEFAULT 'inactive',
  "last_sync_at" timestamp,
  "sync_error" text,
  "connected_by" varchar(100) REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "cloud_storage_org_provider_unique" UNIQUE("organization_id", "provider")
);

CREATE TABLE IF NOT EXISTS "cloud_synced_files" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer REFERENCES "projects"("id") ON DELETE cascade,
  "connection_id" integer REFERENCES "cloud_storage_connections"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "cloud_file_id" varchar(255) NOT NULL,
  "cloud_file_path" text,
  "file_type" varchar(50),
  "size_bytes" bigint,
  "last_synced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(100) NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
