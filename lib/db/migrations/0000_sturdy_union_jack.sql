CREATE TYPE "public"."chat_role" AS ENUM('user', 'bot', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."clinical_note_type" AS ENUM('soap', 'freeform');--> statement-breakpoint
CREATE TYPE "public"."goal_assigned_by" AS ENUM('self', 'therapist');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('incomplete', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'success', 'warning', 'alert');--> statement-breakpoint
CREATE TYPE "public"."risk_alert_type" AS ENUM('crisis', 'mood', 'engagement', 'flag');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"email" varchar(256) NOT NULL,
	"role" "chat_role" DEFAULT 'user' NOT NULL,
	"text" varchar(4096) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"user_id" text,
	"name" varchar(128) NOT NULL,
	"email" varchar(256) NOT NULL,
	"last_message" varchar(4096),
	"last_active" timestamp with time zone DEFAULT now() NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" text NOT NULL,
	"therapist_id" uuid NOT NULL,
	"session_id" uuid,
	"type" "clinical_note_type" DEFAULT 'freeform' NOT NULL,
	"content" varchar(4000) NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" varchar(1000),
	"milestones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_by" "goal_assigned_by" DEFAULT 'self' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"content" varchar(5000) NOT NULL,
	"prompt" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapist_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" text NOT NULL,
	"from_therapist_id" uuid,
	"to_therapist_id" uuid,
	"reason" varchar(1000) NOT NULL,
	"severity" "severity" DEFAULT 'medium' NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"content" varchar(4000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"emoji" varchar(16) NOT NULL,
	"score" integer NOT NULL,
	"note" varchar(1000),
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(128) NOT NULL,
	"message" varchar(512) NOT NULL,
	"type" "notification_type" DEFAULT 'info' NOT NULL,
	"link" varchar(256),
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"email" varchar(254) NOT NULL,
	"goal" varchar(256),
	"therapist_id" uuid,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promos" (
	"code" varchar(64) PRIMARY KEY NOT NULL,
	"used_by" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discount" integer,
	"redemption_limit" integer,
	"expires_at" timestamp with time zone,
	"disabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" text NOT NULL,
	"type" "risk_alert_type" NOT NULL,
	"description" varchar(1000) NOT NULL,
	"severity" "severity" DEFAULT 'medium' NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"bio" varchar(2000) NOT NULL,
	"avatar_url" text,
	"experience" integer NOT NULL,
	"rating" real,
	"specialties" text[],
	"kyc_status" "kyc_status" DEFAULT 'incomplete' NOT NULL,
	"license_number" varchar(64),
	"license_url" text,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapy_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" text NOT NULL,
	"therapist_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"session_type" varchar(32) DEFAULT '1-on-1' NOT NULL,
	"notes" varchar(4000),
	"feedback" varchar(2000),
	"therapist_tracks" jsonb,
	"patient_tracks" jsonb,
	"amount" integer,
	"status" "session_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_conflicts" ADD CONSTRAINT "match_conflicts_from_therapist_id_therapists_id_fk" FOREIGN KEY ("from_therapist_id") REFERENCES "public"."therapists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_conflicts" ADD CONSTRAINT "match_conflicts_to_therapist_id_therapists_id_fk" FOREIGN KEY ("to_therapist_id") REFERENCES "public"."therapists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_session_id_idx" ON "chat_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_last_active_idx" ON "chat_sessions" USING btree ("last_active");--> statement-breakpoint
CREATE INDEX "clinical_notes_patient_id_idx" ON "clinical_notes" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "clinical_notes_therapist_id_idx" ON "clinical_notes" USING btree ("therapist_id");--> statement-breakpoint
CREATE INDEX "goals_user_id_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "journal_entries_user_id_created_at_idx" ON "journal_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "kyc_documents_therapist_id_idx" ON "kyc_documents" USING btree ("therapist_id");--> statement-breakpoint
CREATE INDEX "match_conflicts_resolved_idx" ON "match_conflicts" USING btree ("resolved","created_at");--> statement-breakpoint
CREATE INDEX "messages_session_id_idx" ON "messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "messages_sender_id_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_receiver_id_idx" ON "messages" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "mood_logs_user_id_created_at_idx" ON "mood_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_therapist_id_idx" ON "profiles" USING btree ("therapist_id");--> statement-breakpoint
CREATE INDEX "risk_alerts_resolved_idx" ON "risk_alerts" USING btree ("resolved","created_at");--> statement-breakpoint
CREATE INDEX "risk_alerts_patient_id_idx" ON "risk_alerts" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "session_feedback_session_id_idx" ON "session_feedback" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_feedback_user_id_idx" ON "session_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "therapists_user_id_idx" ON "therapists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "therapy_sessions_patient_id_idx" ON "therapy_sessions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "therapy_sessions_therapist_id_idx" ON "therapy_sessions" USING btree ("therapist_id");--> statement-breakpoint
CREATE INDEX "therapy_sessions_scheduled_at_idx" ON "therapy_sessions" USING btree ("scheduled_at");