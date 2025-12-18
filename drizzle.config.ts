import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  out: './src/lib/db/migrations',
  schema: './src/lib/db/schema',
  dialect: 'postgresql',
  dbCredentials: {
    url: './database',
  },
});
