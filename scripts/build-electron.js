#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* build-electron.js */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIST_ELECTRON = path.resolve(__dirname, 'dist-electron');
const NEXT_STANDALONE = path.resolve(__dirname, '.next/standalone');
const NEXT_TARGET = path.join(DIST_ELECTRON, 'next/standalone');

const NEXT_PORT = process.env.NEXT_PORT || '3000';

function log(msg) {
  console.log(`\x1b[36m[build-electron]\x1b[0m ${msg}`);
}

// Simple cross-platform sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wait until folder exists
async function waitForFolder(folder, timeout = 15000) {
  const start = Date.now();
  while (!fs.existsSync(folder)) {
    if (Date.now() - start > timeout) {
      throw new Error(`Folder ${folder} did not appear within ${timeout}ms`);
    }
    await sleep(200);
  }
}

(async () => {
  try {
    log('1) Building Next.js (standalone output)');
    execSync(`cross-env NEXT_PORT=${NEXT_PORT} next build`, { stdio: 'inherit' });

    log('⏳ Waiting for .next/standalone folder to appear...');
    await waitForFolder(NEXT_STANDALONE);

    log('2) Copying .next/standalone into dist-electron/next/standalone');
    fs.mkdirSync(NEXT_TARGET, { recursive: true });
    fs.cpSync(NEXT_STANDALONE, NEXT_TARGET, { recursive: true });

    log('3) Building Electron (Vite)');
    execSync('vite build --config electron/vite.config.ts', { stdio: 'inherit' });

    log('4) Running electron-forge make');
    execSync('electron-forge make', { stdio: 'inherit' });

    log('✅ Build + package finished successfully');
  } catch (err) {
    console.error(`❌ Build failed: ${err.message}`);
    process.exit(1);
  }
})();