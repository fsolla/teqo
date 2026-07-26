import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Renames the `actionPlan` collection to `activity` ("Plano de Ação" → "Atividade")
 * WITHOUT losing data: every schema object is renamed in place instead of being
 * dropped and recreated. Written by hand because drizzle's generator would emit
 * DROP/CREATE for the tables and cannot see the hand-written partial index
 * `action_plan_upcoming_start_at_idx`.
 *
 * Renaming a table carries its row/array types along, so no `ALTER TYPE` is
 * emitted for `action_plan*` / `_action_plan*`; indexes, constraints and
 * sequences do NOT follow, hence the explicit lists below.
 *
 * Two index names in the lists are fossils from the Município remodel, which
 * renamed the `plaza_id` columns but not their indexes: the database holds
 * `action_plan_plaza_idx` and `campaign_demand_plaza_idx` while the drizzle
 * snapshot expects `*_municipality_idx` — no migration ever created the aligned
 * name, so the fossil is the only name any database can hold. The six remaining
 * `%plaza%` fossils on other tables are aligned here too, so the database matches
 * the snapshot in one pass. Every rename is guarded on the source object existing,
 * so a partially converged environment still lands on the same state.
 */

const renameTables = sql`
  DO $$
  DECLARE
    r record;
    renamed int := 0;
  BEGIN
    FOR r IN SELECT * FROM (VALUES
      ('action_plan', 'activity'),
      ('action_plan_tasks', 'activity_tasks'),
      ('action_plan_updates', 'activity_updates'),
      ('action_plan_rels', 'activity_rels')
    ) AS t(old_name, new_name)
    LOOP
      IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = r.old_name
      ) THEN
        EXECUTE format('ALTER TABLE public.%I RENAME TO %I', r.old_name, r.new_name);
        renamed := renamed + 1;
      END IF;
    END LOOP;
    RAISE NOTICE 'activity rename: % tables', renamed;
  END $$;
`

const renameEnums = sql`
  DO $$
  DECLARE
    r record;
    renamed int := 0;
  BEGIN
    FOR r IN SELECT * FROM (VALUES
      ('enum_action_plan_kind', 'enum_activity_kind'),
      ('enum_action_plan_status', 'enum_activity_status'),
      ('enum_action_plan_origin', 'enum_activity_origin')
    ) AS t(old_name, new_name)
    LOOP
      IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = r.old_name
      ) THEN
        EXECUTE format('ALTER TYPE public.%I RENAME TO %I', r.old_name, r.new_name);
        renamed := renamed + 1;
      END IF;
    END LOOP;
    RAISE NOTICE 'activity rename: % enums', renamed;
  END $$;
`

const renameColumns = sql`
  DO $$
  DECLARE
    r record;
    renamed int := 0;
  BEGIN
    FOR r IN SELECT * FROM (VALUES
      ('campaign_demand', 'action_plan_id', 'activity_id'),
      ('payload_locked_documents_rels', 'action_plan_id', 'activity_id')
    ) AS t(table_name, old_name, new_name)
    LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = r.table_name
          AND column_name = r.old_name
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I RENAME COLUMN %I TO %I',
          r.table_name, r.old_name, r.new_name
        );
        renamed := renamed + 1;
      END IF;
    END LOOP;
    RAISE NOTICE 'activity rename: % columns', renamed;
  END $$;
`

/**
 * Includes the four primary keys — renaming a pkey index renames its constraint
 * with it — and the `%plaza%` fossils described in the file header.
 */
const renameIndexes = sql`
  DO $$
  DECLARE
    r record;
    renamed int := 0;
  BEGIN
    FOR r IN SELECT * FROM (VALUES
      ('action_plan_pkey', 'activity_pkey'),
      ('action_plan_title_idx', 'activity_title_idx'),
      ('action_plan_slug_idx', 'activity_slug_idx'),
      ('action_plan_kind_idx', 'activity_kind_idx'),
      ('action_plan_status_idx', 'activity_status_idx'),
      ('action_plan_deputy_present_idx', 'activity_deputy_present_idx'),
      ('action_plan_start_at_idx', 'activity_start_at_idx'),
      ('action_plan_upcoming_start_at_idx', 'activity_upcoming_start_at_idx'),
      ('action_plan_plaza_idx', 'activity_municipality_idx'),
      ('action_plan_responsible_idx', 'activity_responsible_idx'),
      ('action_plan_leadership_idx', 'activity_leadership_idx'),
      ('action_plan_result_recorded_by_idx', 'activity_result_recorded_by_idx'),
      ('action_plan_created_by_idx', 'activity_created_by_idx'),
      ('action_plan_updated_at_idx', 'activity_updated_at_idx'),
      ('action_plan_created_at_idx', 'activity_created_at_idx'),
      ('action_plan_tasks_pkey', 'activity_tasks_pkey'),
      ('action_plan_tasks_order_idx', 'activity_tasks_order_idx'),
      ('action_plan_tasks_parent_id_idx', 'activity_tasks_parent_id_idx'),
      ('action_plan_tasks_responsible_idx', 'activity_tasks_responsible_idx'),
      ('action_plan_updates_pkey', 'activity_updates_pkey'),
      ('action_plan_updates_order_idx', 'activity_updates_order_idx'),
      ('action_plan_updates_parent_id_idx', 'activity_updates_parent_id_idx'),
      ('action_plan_updates_author_idx', 'activity_updates_author_idx'),
      ('action_plan_rels_pkey', 'activity_rels_pkey'),
      ('action_plan_rels_order_idx', 'activity_rels_order_idx'),
      ('action_plan_rels_parent_idx', 'activity_rels_parent_idx'),
      ('action_plan_rels_path_idx', 'activity_rels_path_idx'),
      ('action_plan_rels_organization_id_idx', 'activity_rels_organization_id_idx'),
      ('action_plan_rels_campaign_user_id_idx', 'activity_rels_campaign_user_id_idx'),
      ('action_plan_rels_media_id_idx', 'activity_rels_media_id_idx'),
      ('campaign_demand_action_plan_idx', 'campaign_demand_activity_idx'),
      ('payload_locked_documents_rels_action_plan_id_idx', 'payload_locked_documents_rels_activity_id_idx'),
      ('campaign_demand_plaza_idx', 'campaign_demand_municipality_idx'),
      ('leadership_rels_plaza_id_idx', 'leadership_rels_municipality_id_idx'),
      ('organization_rels_plaza_id_idx', 'organization_rels_municipality_id_idx'),
      ('supporter_plaza_idx', 'supporter_municipality_idx'),
      ('supporter_contact_plaza_nulls_not_distinct_idx', 'supporter_contact_municipality_nulls_not_distinct_idx'),
      ('vote_pledge_plaza_idx', 'vote_pledge_municipality_idx'),
      ('leadership_plaza_idx', 'leadership_municipality_idx')
    ) AS t(old_name, new_name)
    LOOP
      IF EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = r.old_name
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = r.new_name
      ) THEN
        EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.old_name, r.new_name);
        renamed := renamed + 1;
      END IF;
    END LOOP;
    RAISE NOTICE 'activity rename: % indexes', renamed;
  END $$;
`

const renameForeignKeys = sql`
  DO $$
  DECLARE
    r record;
    renamed int := 0;
  BEGIN
    FOR r IN SELECT * FROM (VALUES
      ('activity', 'action_plan_responsible_id_contact_id_fk', 'activity_responsible_id_contact_id_fk'),
      ('activity', 'action_plan_leadership_id_leadership_id_fk', 'activity_leadership_id_leadership_id_fk'),
      ('activity', 'action_plan_result_recorded_by_id_campaign_user_id_fk', 'activity_result_recorded_by_id_campaign_user_id_fk'),
      ('activity', 'action_plan_created_by_id_campaign_user_id_fk', 'activity_created_by_id_campaign_user_id_fk'),
      ('activity_tasks', 'action_plan_tasks_responsible_id_contact_id_fk', 'activity_tasks_responsible_id_contact_id_fk'),
      ('activity_tasks', 'action_plan_tasks_parent_id_fk', 'activity_tasks_parent_id_fk'),
      ('activity_updates', 'action_plan_updates_author_id_campaign_user_id_fk', 'activity_updates_author_id_campaign_user_id_fk'),
      ('activity_updates', 'action_plan_updates_parent_id_fk', 'activity_updates_parent_id_fk'),
      ('activity_rels', 'action_plan_rels_parent_fk', 'activity_rels_parent_fk'),
      ('activity_rels', 'action_plan_rels_organization_fk', 'activity_rels_organization_fk'),
      ('activity_rels', 'action_plan_rels_campaign_user_fk', 'activity_rels_campaign_user_fk'),
      ('activity_rels', 'action_plan_rels_media_fk', 'activity_rels_media_fk'),
      ('campaign_demand', 'campaign_demand_action_plan_id_action_plan_id_fk', 'campaign_demand_activity_id_activity_id_fk'),
      ('payload_locked_documents_rels', 'payload_locked_documents_rels_action_plan_fk', 'payload_locked_documents_rels_activity_fk')
    ) AS t(table_name, old_name, new_name)
    LOOP
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = r.old_name AND conrelid = to_regclass('public.' || quote_ident(r.table_name))
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
          r.table_name, r.old_name, r.new_name
        );
        renamed := renamed + 1;
      END IF;
    END LOOP;
    RAISE NOTICE 'activity rename: % foreign keys', renamed;
  END $$;
`

const renameSequences = sql`
  DO $$
  DECLARE
    r record;
    renamed int := 0;
  BEGIN
    FOR r IN SELECT * FROM (VALUES
      ('action_plan_id_seq', 'activity_id_seq'),
      ('action_plan_rels_id_seq', 'activity_rels_id_seq')
    ) AS t(old_name, new_name)
    LOOP
      IF EXISTS (
        SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = r.old_name
      ) THEN
        EXECUTE format('ALTER SEQUENCE public.%I RENAME TO %I', r.old_name, r.new_name);
        renamed := renamed + 1;
      END IF;
    END LOOP;
    RAISE NOTICE 'activity rename: % sequences', renamed;
  END $$;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(renameTables)
  await db.execute(renameEnums)
  await db.execute(renameColumns)
  await db.execute(renameIndexes)
  await db.execute(renameForeignKeys)
  await db.execute(renameSequences)
}

/**
 * Symmetric, in reverse order — and deliberately restores the `%plaza%` index
 * names, so `down()` lands on the state that actually existed instead of
 * inventing a half-aligned one.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN SELECT * FROM (VALUES
        ('action_plan_id_seq', 'activity_id_seq'),
        ('action_plan_rels_id_seq', 'activity_rels_id_seq')
      ) AS t(old_name, new_name)
      LOOP
        IF EXISTS (
          SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = r.new_name
        ) THEN
          EXECUTE format('ALTER SEQUENCE public.%I RENAME TO %I', r.new_name, r.old_name);
        END IF;
      END LOOP;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN SELECT * FROM (VALUES
        ('activity', 'action_plan_responsible_id_contact_id_fk', 'activity_responsible_id_contact_id_fk'),
        ('activity', 'action_plan_leadership_id_leadership_id_fk', 'activity_leadership_id_leadership_id_fk'),
        ('activity', 'action_plan_result_recorded_by_id_campaign_user_id_fk', 'activity_result_recorded_by_id_campaign_user_id_fk'),
        ('activity', 'action_plan_created_by_id_campaign_user_id_fk', 'activity_created_by_id_campaign_user_id_fk'),
        ('activity_tasks', 'action_plan_tasks_responsible_id_contact_id_fk', 'activity_tasks_responsible_id_contact_id_fk'),
        ('activity_tasks', 'action_plan_tasks_parent_id_fk', 'activity_tasks_parent_id_fk'),
        ('activity_updates', 'action_plan_updates_author_id_campaign_user_id_fk', 'activity_updates_author_id_campaign_user_id_fk'),
        ('activity_updates', 'action_plan_updates_parent_id_fk', 'activity_updates_parent_id_fk'),
        ('activity_rels', 'action_plan_rels_parent_fk', 'activity_rels_parent_fk'),
        ('activity_rels', 'action_plan_rels_organization_fk', 'activity_rels_organization_fk'),
        ('activity_rels', 'action_plan_rels_campaign_user_fk', 'activity_rels_campaign_user_fk'),
        ('activity_rels', 'action_plan_rels_media_fk', 'activity_rels_media_fk'),
        ('campaign_demand', 'campaign_demand_action_plan_id_action_plan_id_fk', 'campaign_demand_activity_id_activity_id_fk'),
        ('payload_locked_documents_rels', 'payload_locked_documents_rels_action_plan_fk', 'payload_locked_documents_rels_activity_fk')
      ) AS t(table_name, old_name, new_name)
      LOOP
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = r.new_name AND conrelid = to_regclass('public.' || quote_ident(r.table_name))
        ) THEN
          EXECUTE format(
            'ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
            r.table_name, r.new_name, r.old_name
          );
        END IF;
      END LOOP;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN SELECT * FROM (VALUES
        ('action_plan_pkey', 'activity_pkey'),
        ('action_plan_title_idx', 'activity_title_idx'),
        ('action_plan_slug_idx', 'activity_slug_idx'),
        ('action_plan_kind_idx', 'activity_kind_idx'),
        ('action_plan_status_idx', 'activity_status_idx'),
        ('action_plan_deputy_present_idx', 'activity_deputy_present_idx'),
        ('action_plan_start_at_idx', 'activity_start_at_idx'),
        ('action_plan_upcoming_start_at_idx', 'activity_upcoming_start_at_idx'),
        ('action_plan_plaza_idx', 'activity_municipality_idx'),
        ('action_plan_responsible_idx', 'activity_responsible_idx'),
        ('action_plan_leadership_idx', 'activity_leadership_idx'),
        ('action_plan_result_recorded_by_idx', 'activity_result_recorded_by_idx'),
        ('action_plan_created_by_idx', 'activity_created_by_idx'),
        ('action_plan_updated_at_idx', 'activity_updated_at_idx'),
        ('action_plan_created_at_idx', 'activity_created_at_idx'),
        ('action_plan_tasks_pkey', 'activity_tasks_pkey'),
        ('action_plan_tasks_order_idx', 'activity_tasks_order_idx'),
        ('action_plan_tasks_parent_id_idx', 'activity_tasks_parent_id_idx'),
        ('action_plan_tasks_responsible_idx', 'activity_tasks_responsible_idx'),
        ('action_plan_updates_pkey', 'activity_updates_pkey'),
        ('action_plan_updates_order_idx', 'activity_updates_order_idx'),
        ('action_plan_updates_parent_id_idx', 'activity_updates_parent_id_idx'),
        ('action_plan_updates_author_idx', 'activity_updates_author_idx'),
        ('action_plan_rels_pkey', 'activity_rels_pkey'),
        ('action_plan_rels_order_idx', 'activity_rels_order_idx'),
        ('action_plan_rels_parent_idx', 'activity_rels_parent_idx'),
        ('action_plan_rels_path_idx', 'activity_rels_path_idx'),
        ('action_plan_rels_organization_id_idx', 'activity_rels_organization_id_idx'),
        ('action_plan_rels_campaign_user_id_idx', 'activity_rels_campaign_user_id_idx'),
        ('action_plan_rels_media_id_idx', 'activity_rels_media_id_idx'),
        ('campaign_demand_action_plan_idx', 'campaign_demand_activity_idx'),
        ('payload_locked_documents_rels_action_plan_id_idx', 'payload_locked_documents_rels_activity_id_idx'),
        ('campaign_demand_plaza_idx', 'campaign_demand_municipality_idx'),
        ('leadership_rels_plaza_id_idx', 'leadership_rels_municipality_id_idx'),
        ('organization_rels_plaza_id_idx', 'organization_rels_municipality_id_idx'),
        ('supporter_plaza_idx', 'supporter_municipality_idx'),
        ('supporter_contact_plaza_nulls_not_distinct_idx', 'supporter_contact_municipality_nulls_not_distinct_idx'),
        ('vote_pledge_plaza_idx', 'vote_pledge_municipality_idx'),
        ('leadership_plaza_idx', 'leadership_municipality_idx')
      ) AS t(old_name, new_name)
      LOOP
        IF EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = r.new_name
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = r.old_name
        ) THEN
          EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.new_name, r.old_name);
        END IF;
      END LOOP;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN SELECT * FROM (VALUES
        ('campaign_demand', 'action_plan_id', 'activity_id'),
        ('payload_locked_documents_rels', 'action_plan_id', 'activity_id')
      ) AS t(table_name, old_name, new_name)
      LOOP
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = r.table_name
            AND column_name = r.new_name
        ) THEN
          EXECUTE format(
            'ALTER TABLE public.%I RENAME COLUMN %I TO %I',
            r.table_name, r.new_name, r.old_name
          );
        END IF;
      END LOOP;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN SELECT * FROM (VALUES
        ('enum_action_plan_kind', 'enum_activity_kind'),
        ('enum_action_plan_status', 'enum_activity_status'),
        ('enum_action_plan_origin', 'enum_activity_origin')
      ) AS t(old_name, new_name)
      LOOP
        IF EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = r.new_name
        ) THEN
          EXECUTE format('ALTER TYPE public.%I RENAME TO %I', r.new_name, r.old_name);
        END IF;
      END LOOP;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN SELECT * FROM (VALUES
        ('action_plan', 'activity'),
        ('action_plan_tasks', 'activity_tasks'),
        ('action_plan_updates', 'activity_updates'),
        ('action_plan_rels', 'activity_rels')
      ) AS t(old_name, new_name)
      LOOP
        IF EXISTS (
          SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = r.new_name
        ) THEN
          EXECUTE format('ALTER TABLE public.%I RENAME TO %I', r.new_name, r.old_name);
        END IF;
      END LOOP;
    END $$;
  `)
}
