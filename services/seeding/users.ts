import { eq } from 'drizzle-orm';
import { auth } from '../../lib/auth';
import { db } from '../../lib/db/drizzle';
import { UpdateAccount, User } from '../../lib/db/schema';
import { user } from '../../lib/db/schema/auth.schema';

const SEED_USERS: Array<{
  user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
  account: UpdateAccount;
}> = [
  {
    user: {
      name: 'Testing User',
      email: 'testing.user@gmail.com',
      emailVerified: true,
      image: 'https://avatars.githubusercontent.com/u/69223771?s=400&v=4',
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

async function createUsers() {
  for await (const seed of SEED_USERS) {
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, seed.user.email))
      .limit(1);
    if (existingUser.length > 0) {
      console.log(`User with email ${seed.user.email} already exists. Skipping...`);
      continue;
    }
    const { user: newUser } = await auth.api.signUpEmail({
      body: {
        email: seed.user.email!,
        password: seed.account.password!,
        username: seed.user.username!,
        displayUsername: seed.user.displayUsername!,
        name: seed.user.name!,
        image: seed.user.image!,
      },
    });

    await db
      .update(user)
      .set({
        role: seed.user.role,
        emailVerified: seed.user.emailVerified,
      })
      .where(eq(user.id, newUser.id));
  }
}

export async function seedUsers() {
  console.log('Seeding user records...');
  await createUsers();
}
