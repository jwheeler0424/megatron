import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin as adminPlugin, username } from 'better-auth/plugins';
import { db } from '../db/drizzle';
import { hashPassword, verifyPassword } from '../utils/password';
import { ac, admin, superadmin, user } from './permissions';
export const auth = betterAuth({
  appName: 'Megatron',
  advanced: {
    disableOriginCheck: true,
    useSecureCookies: false,
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds (5 minutes)
    },
  },
  plugins: [
    username({
      usernameValidator: (username) => {
        return /^[a-zA-Z0-9_.-]+$/.test(username);
      },
      displayUsernameValidator: (displayUsername) => {
        // Allow only alphanumeric characters, underscores, hyphens, and dots
        return /^[a-zA-Z0-9_.-]+$/.test(displayUsername);
      },
    }),
    adminPlugin({
      adminRoles: ['admin', 'superadmin'],
      ac,
      roles: {
        admin,
        user,
        superadmin,
      },
    }),
    nextCookies(),
  ],
  telemetry: {
    enabled: false,
  },
});
