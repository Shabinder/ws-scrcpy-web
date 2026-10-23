#!/usr/bin/env node
// Stage a vendored adb binary into <repo>/seed/adb/ so DependencyManager.promoteSeedAdb
// can promote it into <dataRoot>/dependencies/adb/adb on first launch — mirroring
// stage-seed-scrcpy-server.mjs.
//
// WHY THIS EXISTS (arm64): Google's platform-tools ships x86-64 Linux binaries only
// (repository2-3.xml lists one `platform-tools_r<ver>-linux.zip`, built for x86-64).
// On arm64 Linux the download "succeeds" and then adb fails to exec. So on arm64-linux
// we source adb from the OS instead — the Docker base is Debian (node:24-trixie-slim),
// and Debian's `adb` package is a maintained, distro-signed, arch-correct AOSP build.
// The Dockerfile's arm64 path installs it and drops the real binary at
// `vendor/adb/linux-arm64/adb` (see docker/stage/); this script seeds it.
//
// x86-64 is unchanged: no vendored binary is expected there, the seed is skipped, and
// the normal Google platform-tools download runs exactly as before.

import { copyFileSync, existsSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// Only arm64 Linux needs a vendored adb; everything else uses Google's platform-tools.
const isArm64Linux = os.platform() === 'linux' && os.arch() === 'arm64';
if (!isArm64Linux) {
    console.log('[stage-seed-adb] not arm64-linux; skipping (Google platform-tools path unchanged)');
    process.exit(0);
}

// The Dockerfile arm64 leg copies the Debian apt adb here before `npm run build`.
const SOURCE = join(REPO_ROOT, 'vendor', 'adb', 'linux-arm64', 'adb');
const SEED_DIR = join(REPO_ROOT, 'seed', 'adb');
const DEST = join(SEED_DIR, 'adb');

if (!existsSync(SOURCE)) {
    console.error(
        `[stage-seed-adb] arm64-linux but ${SOURCE} is missing. ` +
            'The Docker build must install Debian `adb` and place the binary there (see Dockerfile arm64 stage).',
    );
    process.exit(1);
}
if (statSync(SOURCE).size === 0) {
    console.error(`[stage-seed-adb] FATAL: ${SOURCE} is zero-length`);
    process.exit(1);
}

mkdirSync(SEED_DIR, { recursive: true });
copyFileSync(SOURCE, DEST);
chmodSync(DEST, 0o755);
console.log(`[stage-seed-adb] staged arm64 adb seed → ${DEST}`);
