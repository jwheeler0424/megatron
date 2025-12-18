import { timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

// COMMON TIMESTAMP FIELDS
export const timestamps = {
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

export const primaryId = {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
};
