import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "action_plan" ADD COLUMN "task_total" numeric DEFAULT 0;
  ALTER TABLE "action_plan" ADD COLUMN "task_done_count" numeric DEFAULT 0;
  UPDATE "action_plan" AS plan
  SET
    "task_total" = COALESCE(counts.task_total, 0),
    "task_done_count" = COALESCE(counts.task_done_count, 0)
  FROM (
    SELECT
      "_parent_id",
      COUNT(*)::numeric AS task_total,
      COUNT(*) FILTER (WHERE "done" = true)::numeric AS task_done_count
    FROM "action_plan_tasks"
    GROUP BY "_parent_id"
  ) AS counts
  WHERE counts."_parent_id" = plan."id";
  CREATE INDEX "action_plan_upcoming_start_at_idx"
    ON "action_plan" USING btree ("start_at")
    WHERE "status" IN ('planejado', 'confirmado');`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "action_plan_upcoming_start_at_idx";
   ALTER TABLE "action_plan" DROP COLUMN "task_total";
  ALTER TABLE "action_plan" DROP COLUMN "task_done_count";`)
}
