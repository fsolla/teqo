import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_election_tally_office" AS ENUM('presidente', 'governador', 'deputado_federal', 'deputado_estadual');
  CREATE TYPE "public"."enum_election_tally_turn" AS ENUM('1', '2');
  CREATE TYPE "public"."enum_election_candidate_vote_office" AS ENUM('presidente', 'governador', 'deputado_federal', 'deputado_estadual');
  CREATE TYPE "public"."enum_election_candidate_vote_turn" AS ENUM('1', '2');
  CREATE TYPE "public"."enum_election_candidate_vote_vote_type" AS ENUM('nominal', 'legenda');
  CREATE TYPE "public"."enum_election_candidate_office" AS ENUM('presidente', 'governador', 'deputado_federal', 'deputado_estadual');
  CREATE TYPE "public"."enum_election_candidate_turn" AS ENUM('1', '2');
  CREATE TYPE "public"."enum_election_candidate_elected_by" AS ENUM('QP', 'média', '2º turno');
  CREATE TYPE "public"."enum_election_candidate_running_again2026" AS ENUM('sim', 'nao', 'desconhecido');
  CREATE TABLE "election_tally" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"office" "enum_election_tally_office" NOT NULL,
  	"turn" "enum_election_tally_turn" NOT NULL,
  	"state" varchar DEFAULT 'BA' NOT NULL,
  	"city_code" varchar NOT NULL,
  	"city_name" varchar NOT NULL,
  	"zone_number" numeric NOT NULL,
  	"aptos" numeric NOT NULL,
  	"comparecimento" numeric NOT NULL,
  	"abstencoes" numeric NOT NULL,
  	"votos_validos" numeric NOT NULL,
  	"votos_nominais_validos" numeric NOT NULL,
  	"votos_legenda" numeric NOT NULL,
  	"votos_branco" numeric NOT NULL,
  	"votos_nulo" numeric NOT NULL,
  	"votos_anulados" numeric DEFAULT 0 NOT NULL,
  	"winner_candidate_number" numeric,
  	"winner_candidate_name" varchar,
  	"winner_votes" numeric,
  	"winner_coalition" varchar,
  	"winner_party" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "election_candidate_vote" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"office" "enum_election_candidate_vote_office" NOT NULL,
  	"turn" "enum_election_candidate_vote_turn" NOT NULL,
  	"state" varchar DEFAULT 'BA' NOT NULL,
  	"city_code" varchar NOT NULL,
  	"city_name" varchar NOT NULL,
  	"zone_number" numeric NOT NULL,
  	"candidate_number" numeric NOT NULL,
  	"candidate_name" varchar NOT NULL,
  	"coalition" varchar,
  	"party" varchar,
  	"vote_type" "enum_election_candidate_vote_vote_type" DEFAULT 'nominal' NOT NULL,
  	"votes" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "election_candidate" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"office" "enum_election_candidate_office" NOT NULL,
  	"turn" "enum_election_candidate_turn" NOT NULL,
  	"state" varchar DEFAULT 'BA' NOT NULL,
  	"candidate_number" numeric NOT NULL,
  	"urna_name" varchar NOT NULL,
  	"complete_name" varchar,
  	"party" varchar,
  	"coalition" varchar,
  	"candidate_status" varchar,
  	"elected" boolean DEFAULT false,
  	"elected_by" "enum_election_candidate_elected_by",
  	"total_votes_state" numeric,
  	"identity_key" varchar,
  	"running_again2026" "enum_election_candidate_running_again2026" DEFAULT 'desconhecido' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "election_tally_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "election_candidate_vote_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "election_candidate_id" integer;
  CREATE INDEX "election_tally_year_idx" ON "election_tally" USING btree ("year");
  CREATE INDEX "election_tally_office_idx" ON "election_tally" USING btree ("office");
  CREATE INDEX "election_tally_turn_idx" ON "election_tally" USING btree ("turn");
  CREATE INDEX "election_tally_state_idx" ON "election_tally" USING btree ("state");
  CREATE INDEX "election_tally_city_code_idx" ON "election_tally" USING btree ("city_code");
  CREATE INDEX "election_tally_city_name_idx" ON "election_tally" USING btree ("city_name");
  CREATE INDEX "election_tally_zone_number_idx" ON "election_tally" USING btree ("zone_number");
  CREATE INDEX "election_tally_updated_at_idx" ON "election_tally" USING btree ("updated_at");
  CREATE INDEX "election_tally_created_at_idx" ON "election_tally" USING btree ("created_at");
  CREATE UNIQUE INDEX "year_office_turn_state_cityCode_zoneNumber_idx" ON "election_tally" USING btree ("year","office","turn","state","city_code","zone_number");
  CREATE INDEX "election_candidate_vote_year_idx" ON "election_candidate_vote" USING btree ("year");
  CREATE INDEX "election_candidate_vote_office_idx" ON "election_candidate_vote" USING btree ("office");
  CREATE INDEX "election_candidate_vote_turn_idx" ON "election_candidate_vote" USING btree ("turn");
  CREATE INDEX "election_candidate_vote_state_idx" ON "election_candidate_vote" USING btree ("state");
  CREATE INDEX "election_candidate_vote_city_code_idx" ON "election_candidate_vote" USING btree ("city_code");
  CREATE INDEX "election_candidate_vote_city_name_idx" ON "election_candidate_vote" USING btree ("city_name");
  CREATE INDEX "election_candidate_vote_zone_number_idx" ON "election_candidate_vote" USING btree ("zone_number");
  CREATE INDEX "election_candidate_vote_candidate_number_idx" ON "election_candidate_vote" USING btree ("candidate_number");
  CREATE INDEX "election_candidate_vote_vote_type_idx" ON "election_candidate_vote" USING btree ("vote_type");
  CREATE INDEX "election_candidate_vote_updated_at_idx" ON "election_candidate_vote" USING btree ("updated_at");
  CREATE INDEX "election_candidate_vote_created_at_idx" ON "election_candidate_vote" USING btree ("created_at");
  CREATE UNIQUE INDEX "compound_index_idx" ON "election_candidate_vote" USING btree ("year","office","turn","state","city_code","zone_number","candidate_number","vote_type");
  CREATE INDEX "election_candidate_year_idx" ON "election_candidate" USING btree ("year");
  CREATE INDEX "election_candidate_office_idx" ON "election_candidate" USING btree ("office");
  CREATE INDEX "election_candidate_turn_idx" ON "election_candidate" USING btree ("turn");
  CREATE INDEX "election_candidate_state_idx" ON "election_candidate" USING btree ("state");
  CREATE INDEX "election_candidate_candidate_number_idx" ON "election_candidate" USING btree ("candidate_number");
  CREATE INDEX "election_candidate_elected_idx" ON "election_candidate" USING btree ("elected");
  CREATE INDEX "election_candidate_identity_key_idx" ON "election_candidate" USING btree ("identity_key");
  CREATE INDEX "election_candidate_updated_at_idx" ON "election_candidate" USING btree ("updated_at");
  CREATE INDEX "election_candidate_created_at_idx" ON "election_candidate" USING btree ("created_at");
  CREATE UNIQUE INDEX "year_office_turn_state_candidateNumber_idx" ON "election_candidate" USING btree ("year","office","turn","state","candidate_number");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_election_tally_fk" FOREIGN KEY ("election_tally_id") REFERENCES "public"."election_tally"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_election_candidate_vote_fk" FOREIGN KEY ("election_candidate_vote_id") REFERENCES "public"."election_candidate_vote"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_election_candidate_fk" FOREIGN KEY ("election_candidate_id") REFERENCES "public"."election_candidate"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_election_tally_id_idx" ON "payload_locked_documents_rels" USING btree ("election_tally_id");
  CREATE INDEX "payload_locked_documents_rels_election_candidate_vote_id_idx" ON "payload_locked_documents_rels" USING btree ("election_candidate_vote_id");
  CREATE INDEX "payload_locked_documents_rels_election_candidate_id_idx" ON "payload_locked_documents_rels" USING btree ("election_candidate_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "election_tally" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "election_candidate_vote" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "election_candidate" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "election_tally" CASCADE;
  DROP TABLE "election_candidate_vote" CASCADE;
  DROP TABLE "election_candidate" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_election_tally_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_election_candidate_vote_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_election_candidate_fk";
  
  DROP INDEX "payload_locked_documents_rels_election_tally_id_idx";
  DROP INDEX "payload_locked_documents_rels_election_candidate_vote_id_idx";
  DROP INDEX "payload_locked_documents_rels_election_candidate_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "election_tally_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "election_candidate_vote_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "election_candidate_id";
  DROP TYPE "public"."enum_election_tally_office";
  DROP TYPE "public"."enum_election_tally_turn";
  DROP TYPE "public"."enum_election_candidate_vote_office";
  DROP TYPE "public"."enum_election_candidate_vote_turn";
  DROP TYPE "public"."enum_election_candidate_vote_vote_type";
  DROP TYPE "public"."enum_election_candidate_office";
  DROP TYPE "public"."enum_election_candidate_turn";
  DROP TYPE "public"."enum_election_candidate_elected_by";
  DROP TYPE "public"."enum_election_candidate_running_again2026";`)
}
