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
    name: "NextJS Electron RSC",
    asar: true,
    afterCopy: [
      async (buildPath, electronVersion, platform, arch, callback) => {
        try {
          const standaloneSrc = path.join(__dirname, ".next", "standalone");
          const standaloneDest = path.join(buildPath, "standalone");
          console.log({ buildPath });

          await fs.copy(standaloneSrc, standaloneDest);
          console.log("✅ Copied standalone build to Electron resources");

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
