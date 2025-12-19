import { sql } from 'drizzle-orm';
import { customType, PgColumn, timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

export type RequiredKey<
  BaseRecord extends Record<string, unknown>,
  Key extends keyof BaseRecord,
> = Pick<BaseRecord, Key>;

export type OptionalKeys<
  BaseRecord extends Record<string, unknown>,
  Key extends keyof BaseRecord | undefined,
> = Partial<Key extends keyof BaseRecord ? Omit<BaseRecord, Key> : BaseRecord>;

/**
 * Helper function to create a SQL expression for a `tsvector` column from multiple text columns.
 * @param columns An array of columns to be combined into a tsvector.
 * @returns A SQL expression for `to_tsvector`.
 */
export function generateTsvector(columns: PgColumn[]) {
  const parts = columns.map((col) => {
    // We use coalesce to handle null values gracefully
    return sql`coalesce(${col}, '')`;
  });
  // The 'english' configuration can be changed to match your database settings
  return sql`to_tsvector('english', ${sql.join(parts, sql` || ' ' || `)})`;
}

/**
 * Defines a custom Drizzle type for PostgreSQL's `tsvector`.
 *
 * This function allows you to use `tsvector` columns in your Drizzle schema,
 * which are essential for full-text search capabilities. The `customType` helper
 * maps the TypeScript `string` type to the `tsvector` SQL type.
 *
 * @returns A custom type definition for `tsvector`
 */
export const tsvector = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'tsvector';
  },
  // We can return the data directly as it's a string representation
  // in both the Drizzle and PostgreSQL driver contexts.
  fromDriver: (value: string) => value,
  toDriver: (value: string) => value,
});

export const idPrimaryKey = uuid('id')
  .primaryKey()
  .$defaultFn(() => uuidv7());

export const timestamps = {
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const softDelete = {
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
};

export const archived = {
  archivedAt: timestamp('archived_at', { mode: 'date' }),
};
