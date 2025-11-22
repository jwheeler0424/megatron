import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const DIST_ELECTRON = path.resolve(__dirname, 'dist-electron');
const NEXT_STANDALONE = path.resolve(__dirname, '.next/standalone');
const NEXT_TARGET = path.join(DIST_ELECTRON, 'next/standalone');

const config: ForgeConfig = {
  packagerConfig: {
    executableName: 'megatron',
    name: 'NextJS Electron RSC',
    asar: true,
    extraResource: [
      // FIX: We only need the standalone folder. 
      // Electron Forge copies this to 'resources/standalone'
      path.join(process.cwd(), '.next', 'standalone'),
    ],
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  hooks: {
    prePackage: async () => {
      console.log('Building Next.js and Electron before packaging...');
      execSync('next build', { stdio: 'inherit' });
      // console.log('Copying .next/standalone into dist-electron/next/standalone');
      //     fs.mkdirSync(NEXT_TARGET, { recursive: true });
      //     fs.cpSync(NEXT_STANDALONE, NEXT_TARGET, { recursive: true });
      
          console.log('Building Electron (Vite)');
          execSync('vite build --config electron/vite.config.ts', { stdio: 'inherit' })
      
          console.log('✅ Build + package finished successfully');
      console.log('Builds complete.');
    },
  },
};

export default config;