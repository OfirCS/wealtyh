#!/usr/bin/env node
/**
 * Static-export build for GitHub Pages.
 *
 * Strategy: Next.js `output: 'export'` refuses to build with route handlers
 * (the `/api/*` folders). We temporarily rename those out of the build, run
 * `next build`, then restore them. Demo-mode shims in src/lib/claude.ts take
 * over for AI calls when NEXT_PUBLIC_STATIC_DEMO=true.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const apiDir = join(root, 'src', 'app', 'api');
const apiStash = join(root, '.api-stash');
const outDir = join(root, 'out');

let moved = false;

function restore() {
  if (moved && existsSync(apiStash)) {
    renameSync(apiStash, apiDir);
    moved = false;
    console.log('[build-static] Restored src/app/api');
  }
}

process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

try {
  if (existsSync(apiDir)) {
    if (existsSync(apiStash)) {
      console.error('[build-static] ERROR: .api-stash already exists. Aborting.');
      process.exit(1);
    }
    renameSync(apiDir, apiStash);
    moved = true;
    console.log('[build-static] Moved src/app/api → .api-stash');
  }

  // Clean previous out/
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }

  const env = {
    ...process.env,
    NEXT_PUBLIC_STATIC_DEMO: 'true',
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? '/wealtyh',
  };

  console.log(`[build-static] Running next build (basePath=${env.NEXT_PUBLIC_BASE_PATH})`);
  const result = spawnSync('npx', ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    console.error('[build-static] next build failed');
    process.exit(result.status ?? 1);
  }

  // GitHub Pages: disable Jekyll processing (so _next/ folder serves correctly)
  writeFileSync(join(outDir, '.nojekyll'), '');
  console.log('[build-static] Wrote out/.nojekyll');

  console.log('[build-static] Done — out/ ready for deploy');
} finally {
  restore();
}
