import { boolean, pgTable as table, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';
import { idPrimaryKey, timestamps } from './common.schema';

export const user = table('user', {
  id: idPrimaryKey,
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  ...timestamps,
  role: text('role', { enum: ['user', 'admin', 'superadmin'] })
    .notNull()
    .default('user'),
  banned: boolean('banned'),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  twoFactorEnabled: boolean('two_factor_enabled'),
  username: text('username').unique(),
  displayUsername: text('display_username'),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type UpdateUser = Partial<NewUser>;

export const account = table('account', {
  id: idPrimaryKey,
  accountId: uuid('account_id')
    .$defaultFn(() => uuidv7())
    .notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type UpdateAccount = Partial<NewAccount>;

export const verification = table('verification', {
  id: idPrimaryKey,
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
});

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type UpdateVerification = Partial<NewVerification>;

export const twoFactor = table('two_factor', {
  id: idPrimaryKey,
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export type TwoFactor = typeof twoFactor.$inferSelect;
export type NewTwoFactor = typeof twoFactor.$inferInsert;
export type UpdateTwoFactor = Partial<NewTwoFactor>;
