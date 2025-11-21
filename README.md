# Next.js + Electron (Vite) Full Template

## Development

1. Install dependencies: `npm install`
2. Start dev: `npm run dev`
   - This starts `next dev` and Vite (Electron) concurrently.
   - Electron will point to http://localhost:3000

## Production build

1. `npm run build` — runs `next build` and builds electron via vite and runs `electron-forge make`.
2. The packaged installer is produced by Forge in `out/make/*`.

## Notes
- Ensure the packaged result contains the Next.js `standalone` server output.
- For a smoother packaging pipeline, add copy steps in `scripts/build-electron.js` to include `.next/standalone` into the Forge resource dir.