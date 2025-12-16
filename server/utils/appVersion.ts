import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_VERSION = "dev";
const DEFAULT_PREFIX = "eh";
const VERSION_FILE = resolve(process.cwd(), "app.version");

let cachedVersion: string | null = null;

const readVersionFromFile = () => {
  try {
    const content = readFileSync(VERSION_FILE, "utf-8").trim();
    return content.length ? content : null;
  } catch {
    return null;
  }
};

const resolveVersion = () => {
  if (cachedVersion) return cachedVersion;
  const versionFromEnv = process.env.APP_VERSION?.trim();
  if (versionFromEnv) {
    cachedVersion = versionFromEnv;
    return cachedVersion;
  }
  const fromFile = readVersionFromFile();
  if (fromFile) {
    cachedVersion = fromFile;
    return cachedVersion;
  }
  cachedVersion = DEFAULT_VERSION;
  return cachedVersion;
};

export const APP_VERSION = resolveVersion();

const resolvePrefix = () => process.env.APP_VERSION_PREFIX?.trim() || DEFAULT_PREFIX;

export const APP_VERSION_PREFIX = resolvePrefix();
export const APP_VERSION_TAG = `${APP_VERSION_PREFIX}-${APP_VERSION}`;

// Ensure the resolved version is also available to Nuxt runtime when possible.
if (!process.env.NUXT_APP_VERSION) {
  process.env.NUXT_APP_VERSION = APP_VERSION;
}

if (!process.env.NUXT_PUBLIC_APP_VERSION) {
  process.env.NUXT_PUBLIC_APP_VERSION = APP_VERSION;
}

