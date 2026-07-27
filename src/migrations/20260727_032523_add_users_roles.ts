import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'editor');
    CREATE TABLE "users_roles" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_users_roles",
      "id" serial PRIMARY KEY NOT NULL
    );

    ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
    CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  `)

  // Pre-existing admins were omnipotent; grant them the `admin` role so
  // tightening `isPayloadAdmin` does not lock everyone out of `/admin`.
  const backfill = await db.execute(sql`
    INSERT INTO "users_roles" ("order", "parent_id", "value")
    SELECT 1, u.id, 'admin'::"enum_users_roles"
    FROM "users" u
    WHERE NOT EXISTS (
      SELECT 1 FROM "users_roles" r WHERE r."parent_id" = u.id
    )
    RETURNING "parent_id"
  `)

  const rowCount = Array.isArray(backfill)
    ? backfill.length
    : ((backfill as { rowCount?: number | null }).rowCount ?? 0)
  console.info(`[add_users_roles] backfilled admin role for ${rowCount} user(s)`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "users_roles" CASCADE;
    DROP TYPE "public"."enum_users_roles";
  `)
}
