import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { execSync } from 'child_process';
import path from 'path';

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
      execSync('npm run build:next', { stdio: 'inherit' });
      execSync('npm run build:electron', { stdio: 'inherit' });
      console.log('Builds complete.');
    },
  },
};

export default config;