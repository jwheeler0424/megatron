#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process');

const next = spawn('npm', ['run', 'next:dev'], { stdio: 'inherit', shell: true });
const vite = spawn('npm', ['run', 'electron:dev'], { stdio: 'inherit', shell: true });

// Ensure child processes are killed on exit
process.on('exit', () => {
  next.kill();
  vite.kill();
});
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());