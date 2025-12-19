import { FusesPlugin } from '@electron-forge/plugin-fuses';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs-extra';
import path from 'path';

import { execSync } from 'child_process';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { UpdateAccount, User } from './lib/db/schema/auth.schema';
import { hashPassword } from './lib/utils/password';
import packageJson from './package.json';
import { maybeFetchContributors } from './tools/contributors';
import { populateReleases } from './tools/fetch-releases';

const { version } = packageJson;
const iconDir = path.resolve(__dirname, 'assets', 'icons');
const root = process.cwd();

const commonLinuxConfig = {
  categories: ['Development', 'Utility'],
  icon: {
    '1024x1024': path.resolve(iconDir, 'fiddle.png'),
    scalable: path.resolve(iconDir, 'fiddle.svg'),
  },
  mimeType: ['x-scheme-handler/electron-fiddle'],
};

const requirements = path.resolve(__dirname, 'tools/certs/requirements.txt');

const config: ForgeConfig = {
  hooks: {
    generateAssets: async () => {
      await Promise.all([populateReleases(), maybeFetchContributors(true)]);
    },
  },
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  packagerConfig: {
    executableName: 'megatron',
    name: 'Megatron',
    asar: true,
    icon: path.resolve(__dirname, 'assets', 'icons', 'megatron'),
    appBundleId: 'com.electron.megatron',
    usageDescription: {
      Camera:
        'Access is needed by certain built-in features in addition to any custom features that use the Camera',
      Microphone:
        'Access is needed by certain built-in features in addition to any custom features that use the Microphone',
      Calendars:
        'Access is needed by certain built-in features in addition to any custom features that may access Calendars',
      Contacts:
        'Access is needed by certain built-in features in addition to any custom features that may access Contacts',
      Reminders:
        'Access is needed by certain built-in features in addition to any custom features that may access Reminders',
    },
    appCategoryType: 'private.app-category.enterprise-tools',
    protocols: [
      {
        name: 'Megatron',
        schemes: ['megatron'],
      },
    ],
    win32metadata: {
      CompanyName: 'Megatron Boilerplate',
      OriginalFilename: 'Megatron',
    },
    ignore: [/app/, /types/, /.next/, /.vscode/, /.git(ignore|modules)/, /scripts/],
    afterCopy: [
      async (buildPath, electronVersion, platform, arch, callback) => {
        try {
          const standaloneSrc = path.join(__dirname, '.next', 'standalone');
          const standaloneDest = path.join(buildPath);
          console.log({ buildPath });

          await fs.copy(standaloneSrc, standaloneDest);
          console.log('✅ Copied standalone build to Electron resources');

          const nextStaticSrc = path.join(__dirname, '.next', 'static');
          const nextStaticDest = path.join(buildPath, '.next', 'static');
          await fs.copy(nextStaticSrc, nextStaticDest);
          console.log('✅ Copied .next/static to Electron resources');

          const nextElectronSrc = path.join(__dirname, 'build', 'next-electron.js');
          const nextElectronDest = path.join(buildPath, 'build', 'next-electron.js');
          await fs.copy(nextElectronSrc, nextElectronDest);
          console.log('✅ Copied next-electron.js to Electron resources');

          const certDir = path.join(buildPath, 'certificates');
          const keyPath = path.join(certDir, 'localhost-key.pem');
          const certPath = path.join(certDir, 'localhost.pem');

          if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir);
          }

          if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
            try {
              // Requires mkcert to be installed on the system
              execSync(`mkcert -install`, { stdio: 'inherit' });
              execSync(
                `mkcert -key-file ${keyPath} -cert-file ${certPath} localhost 127.0.0.1 ::1`,
                {
                  stdio: 'inherit',
                }
              );
              console.log('✅ Generated self-signed certificates for localhost');
            } catch (error) {
              console.error('❌ Error generating certificates:', error);
              process.exit(1);
            }
          }

          const dbPath = path.join(buildPath, 'database');

          const dbConfigSrc = path.join(__dirname, 'drizzle.config.electron.ts');
          const dbConfigDest = path.join(buildPath, 'drizzle.config.ts');
          await fs.copy(dbConfigSrc, dbConfigDest);
          console.log('✅ Copied Drizzle config to Electron resources');
          const dbSchemaSrc = path.join(__dirname, 'src', 'lib', 'db', 'schema');
          const dbSchemaDest = path.join(buildPath, 'lib', 'db', 'schema');
          await fs.copy(dbSchemaSrc, dbSchemaDest);
          console.log('✅ Copied Drizzle schema to Electron resources');

          try {
            execSync(`npx drizzle-kit generate --config=./drizzle.config.ts`, { cwd: buildPath });
          } catch (e) {
            console.log('Migration generation failed, continuing anyway...');
          }

          try {
            execSync(`npx drizzle-kit migrate --config=./drizzle.config.ts`, { cwd: buildPath });
          } catch (e) {
            console.log('Migration failed, continuing anyway...');
          }

          const db = drizzle(`${dbPath}`);
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

          const { user, account } = await import(
            path.join(buildPath, 'lib', 'db', 'schema', 'auth.schema.js')
          );

          async function createUsers() {
            for await (const seed of SEED_USERS) {
              const hashedPassword = await hashPassword(
                seed.account.password ?? 'SuperSecretPassword'
              );
              const existingUser = await db
                .select()
                .from(user)
                .where(eq(user.email, seed.user.email))
                .limit(1);
              if (existingUser.length > 0) {
                console.log(`User with email ${seed.user.email} already exists. Skipping...`);
                continue;
              }
              const [result] = await db
                .insert(user)
                .values(seed.user)
                .onConflictDoUpdate({
                  target: user.email,
                  set: { ...seed.user },
                })
                .returning({ userId: user.id });

              const { userId } = result;
              const existingAccountRow = (
                await db.select().from(account).where(eq(account.userId, userId)).limit(1)
              )[0];
              const existingAccountId = existingAccountRow?.id;
              await db
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
                  set: { ...seed.account, id: existingAccountId },
                });
            }
          }
          await createUsers();
          console.log('✅ Seeded users into the database');

          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    ],
    // Prune the large node_modules, we rely on the ones bundled inside standalone
    prune: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: (arch: string) => ({
        name: 'megatron',
        authors: 'Jonathan Wheeler',
        exe: 'megatron.exe',
        iconUrl:
          'https://raw.githubusercontent.com/jwheeler0424/megatron/refs/heads/main/assets/icons/megatron-setup.ico',
        // loadingGif: "./assets/loading.gif",
        noMsi: true,
        setupExe: `megatron-${version}-win32-${arch}-setup.exe`,
        setupIcon: path.resolve(iconDir, 'megatron-setup.ico'),
        // signWithParams: process.env.CERT_FINGERPRINT
        //   ? `/sha1 ${process.env.CERT_FINGERPRINT} /tr http://timestamp.digicert.com /td SHA256 /fd SHA256`
        //   : undefined,
      }),
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: commonLinuxConfig,
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: commonLinuxConfig,
    },
    {
      name: '@reforged/maker-appimage',
      platforms: ['linux'],
      config: {
        options: commonLinuxConfig,
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'jwheeler0424',
          name: 'megatron',
        },
        prerelease: false,
        draft: true,
        generateReleaseNotes: true,
      },
    },
  ],
};

export default config;
