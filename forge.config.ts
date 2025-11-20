import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { execSync } from "child_process";
import path from "path";

const config: ForgeConfig = {
  packagerConfig: {
    // Defines the entry point for the packaged app
    executableName: "nextjs-electron-rsc",
    name: "NextJS Electron RSC",
    asar: true,
    // CRUCIAL: Add the bundled Next.js server files to the final package
    extraResource: [
      // The entire standalone output (contains server.js, modules, and static assets)
      path.join(process.cwd(), ".next", "standalone"),
      // The shared static assets that might be accessed directly
      path.join(process.cwd(), ".next", "static"),
      path.join(process.cwd(), "public"),
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  // ----------------------------------------------------
  // IMPORTANT: The Forge Hooks
  // ----------------------------------------------------
  hooks: {
    // Before packaging, ensure both Next.js and Electron (main/preload) are built.
    prePackage: async () => {
      console.log("Building Next.js and Electron before packaging...");

      // 1. Build Next.js (runs 'next build' and copies assets via 'copy-standalone-files.js')
      execSync("npm run build:next", { stdio: "inherit" });

      // 2. Build Electron main/preload (runs esbuild for production)
      execSync("npm run build:electron:prod", { stdio: "inherit" });

      console.log("Builds complete.");
    },
  },
};

export default config;
