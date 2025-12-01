import fs from "fs-extra";
import path from "path";

async function build() {
  const rootDir = process.cwd();
  const nextDir = path.join(rootDir, ".next");
  const standaloneDir = path.join(nextDir, "standalone");

  console.log("🏗️ Optimizing Next.js standalone build for Electron...");

  // 1. Copy the 'static' folder to the standalone directory
  // Next.js standalone does not automatically copy these
  const staticSrc = path.join(nextDir, "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  await fs.copy(staticSrc, staticDest);
  console.log("✅ Copied .next/static");

  // 2. Copy the 'public' folder
  const publicSrc = path.join(rootDir, "public");
  const publicDest = path.join(standaloneDir, "public");
  if (await fs.pathExists(publicSrc)) {
    await fs.copy(publicSrc, publicDest);
    console.log("✅ Copied public folder");
  }

  console.log("🚀 Build ready for packaging in .next/standalone");
}

build().catch(console.error);
