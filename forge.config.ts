import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import type { ForgeConfig } from "@electron-forge/shared-types";
import fs from "fs-extra";
import path from "path";

const config: ForgeConfig = {
  packagerConfig: {
    executableName: "megatron",
    name: "Megatron",
    asar: true,
    ignore: [
      /app/,
      /types/,
      /.next/,
      /.vscode/,
      /.git(ignore|modules)/,
      /scripts/,
    ],
    afterCopy: [
      async (buildPath, electronVersion, platform, arch, callback) => {
        try {
          const standaloneSrc = path.join(__dirname, ".next", "standalone");
          const standaloneDest = path.join(buildPath);
          console.log({ buildPath });

          await fs.copy(standaloneSrc, standaloneDest);
          console.log("✅ Copied standalone build to Electron resources");

          const nextStaticSrc = path.join(__dirname, ".next", "static");
          const nextStaticDest = path.join(buildPath, ".next", "static");
          await fs.copy(nextStaticSrc, nextStaticDest);
          console.log("✅ Copied .next/static to Electron resources");

          const nextElectronSrc = path.join(
            __dirname,
            "build",
            "next-electron.js"
          );
          const nextElectronDest = path.join(
            buildPath,
            "build",
            "next-electron.js"
          );
          await fs.copy(nextElectronSrc, nextElectronDest);
          console.log("✅ Copied next-electron.js to Electron resources");

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
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
};

export default config;
