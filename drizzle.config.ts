import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  out: './src/lib/db/migrations',
  schema: './src/lib/db/schema',
  dialect: 'postgresql',
  driver: 'pglite',
  dbCredentials: {
    url: 'file:./src/database/',
  },
});
