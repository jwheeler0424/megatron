import { adminClient, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { ac, admin, superadmin, user } from './permissions';

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  advanced: {
    disableOriginCheck: true,
    useSecureCookies: false,
  },
  plugins: [
    usernameClient(),
    adminClient({
      ac,
      roles: {
        admin,
        user,
        superadmin,
      },
    }),
  ],
});
