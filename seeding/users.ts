import { eq } from 'drizzle-orm';
import { Database, db } from '../lib/db/drizzle';
import { UpdateAccount, User } from '../lib/db/schema';
import { account, user } from '../lib/db/schema/auth.schema';
import { hashPassword } from '../lib/utils/password';

const SEED_USERS: Array<{
  user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
  account: UpdateAccount;
}> = [
  {
    user: {
      name: 'Testing User',
      email: 'testing.user@gmail.com',
      emailVerified: true,
      image: 'https://github.com/shadcn.png',
      username: 'tuser',
      displayUsername: 'tuser',
      role: 'superadmin',
      banned: null,
      banExpires: null,
      banReason: null,
      twoFactorEnabled: false,
    },
    account: { password: 'Password123!', providerId: 'user' },
  },
];

export async function createUsers(dbInstance: Database = db) {
  for await (const seed of SEED_USERS) {
    const hashedPassword = await hashPassword(seed.account.password ?? 'SuperSecretPassword');
    const existingUser = await dbInstance
      .select()
      .from(user)
      .where(eq(user.email, seed.user.email))
      .limit(1);
    if (existingUser.length > 0) {
      console.log(`User with email ${seed.user.email} already exists. Skipping...`);
      continue;
    }
    const [result] = await dbInstance
      .insert(user)
      .values(seed.user)
      .onConflictDoUpdate({
        target: user.email,
        set: { ...seed.user },
      })
      .returning({ userId: user.id });

    const { userId } = result;
    const existingAccount = await dbInstance.query.account.findFirst({
      where: (account, { eq }) => eq(account.userId, userId),
    });
    await dbInstance
      .insert(account)
      .values({
        providerId: seed.account.providerId ?? 'user',
        userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: account.id,
        set: { ...seed.account, id: existingAccount?.id },
      });
  }
}

export async function seedUsers() {
  console.log('Seeding user records...');
  await createUsers();
}
/* 
await db.execute(sql`
            INSERT INTO "user"
                (name, email, email_verified, image, username, display_username, role, banned, ban_expires, ban_reason, two_factor_enabled, created_at, updated_at)
            VALUES
                (
                    'Testing User',
                    'testing.user@gmail.com',
                    TRUE,
                    'https://github.com/shadcn.png',
                    'tuser',
                    'tuser',
                    'superadmin',
                    NULL,
                    NULL,
                    NULL,
                    FALSE,
                    NOW(),
                    NOW()
                )
            ON CONFLICT (email)
            DO UPDATE
            SET
                name=EXCLUDED.name,
                email_verified=EXCLUDED.email_verified,
                image=EXCLUDED.image,
                username=EXCLUDED.username,
                display_username=EXCLUDED.display_username,
                role=EXCLUDED.role,
                banned=EXCLUDED.banned,
                ban_expires=EXCLUDED.ban_expires,
                ban_reason=EXCLUDED.ban_reason,
                two_factor_enabled=EXCLUDED.two_factor_enabled,
                updated_at=NOW();

            WITH ins AS (
                SELECT id AS user_id
                FROM "user"
                WHERE email = 'testing.user@gmail.com'
                LIMIT 1
            )
            INSERT INTO account
                (provider_id, user_id, password, created_at, updated_at)
            SELECT
                'user',
                ins.user_id,
                '__HASHED_PASSWORD__', -- Replace this manually!
                NOW(),
                NOW()
            FROM ins
            ON CONFLICT (user_id)
            DO UPDATE
            SET
                provider_id = EXCLUDED.provider_id,
                password = EXCLUDED.password,
                updated_at = NOW()
          `);*/
