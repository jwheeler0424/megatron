import { FusesPlugin } from '@electron-forge/plugin-fuses';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs-extra';
import path from 'path';

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
