import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import { join, relative } from "node:path";
import type {
  AppMetadata,
  InfoPlist,
  PrivacyManifest,
  ProjectSnapshot,
  SourceFile,
} from "@shiproof/preflight-engine";
import { isPlistDict, parsePlist, type PlistValue } from "./plist.js";

const SOURCE_EXT = /\.(swift|m|mm|h|c|cc|cpp)$/i;
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "build",
  "DerivedData",
  ".build",
  "Pods",
  "Carthage",
  "dist",
  ".swiftpm",
]);
const MAX_FILE_BYTES = 2_000_000;

export type ScanResult = {
  snapshot: ProjectSnapshot;
  /** Non-fatal problems (unreadable file, malformed plist) surfaced, not swallowed. */
  warnings: string[];
};

type Collector = {
  root: string;
  sourceFiles: SourceFile[];
  privacyManifests: PrivacyManifest[];
  infoPlists: InfoPlist[];
  warnings: string[];
};

function walk(dir: string, collector: Collector): void {
  let entries: Dirent<string>[];
  try {
    entries = readdirSync(dir, { withFileTypes: true, encoding: "utf8" });
  } catch (err) {
    collector.warnings.push(`Could not read directory ${dir}: ${errText(err)}`);
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, collector);
      continue;
    }
    if (!entry.isFile()) continue;
    handleFile(full, collector);
  }
}

function handleFile(full: string, collector: Collector): void {
  const name = full.split("/").pop() ?? full;
  const rel = relative(collector.root, full);

  if (name.endsWith(".xcprivacy")) {
    const manifest = readPrivacyManifest(full, rel, collector.warnings);
    if (manifest) collector.privacyManifests.push(manifest);
    return;
  }
  if (name === "Info.plist") {
    const plist = readInfoPlist(full, rel, collector.warnings);
    if (plist) collector.infoPlists.push(plist);
    return;
  }
  if (SOURCE_EXT.test(name)) {
    const content = readTextCapped(full, collector.warnings);
    if (content !== undefined) collector.sourceFiles.push({ path: rel, content });
  }
}

function readTextCapped(full: string, warnings: string[]): string | undefined {
  try {
    if (statSync(full).size > MAX_FILE_BYTES) return undefined;
    return readFileSync(full, "utf8");
  } catch (err) {
    warnings.push(`Could not read ${full}: ${errText(err)}`);
    return undefined;
  }
}

function readPrivacyManifest(
  full: string,
  rel: string,
  warnings: string[],
): PrivacyManifest | undefined {
  const text = readTextCapped(full, warnings);
  if (text === undefined) return undefined;
  let parsed: PlistValue;
  try {
    parsed = parsePlist(text);
  } catch (err) {
    warnings.push(`Skipped malformed privacy manifest ${rel}: ${errText(err)}`);
    return undefined;
  }
  if (!isPlistDict(parsed)) return { path: rel, accessedApiTypes: [] };

  const accessed = parsed["NSPrivacyAccessedAPITypes"];
  const accessedApiTypes: PrivacyManifest["accessedApiTypes"] = [];
  if (Array.isArray(accessed)) {
    for (const entry of accessed) {
      if (!isPlistDict(entry)) continue;
      const category = entry["NSPrivacyAccessedAPIType"];
      const reasonsRaw = entry["NSPrivacyAccessedAPITypeReasons"];
      if (typeof category !== "string") continue;
      const reasons = Array.isArray(reasonsRaw)
        ? reasonsRaw.filter((r): r is string => typeof r === "string")
        : [];
      accessedApiTypes.push({ category, reasons });
    }
  }
  return { path: rel, accessedApiTypes };
}

function readInfoPlist(full: string, rel: string, warnings: string[]): InfoPlist | undefined {
  const text = readTextCapped(full, warnings);
  if (text === undefined) return undefined;
  let parsed: PlistValue;
  try {
    parsed = parsePlist(text);
  } catch (err) {
    warnings.push(`Skipped malformed Info.plist ${rel}: ${errText(err)}`);
    return undefined;
  }
  const values: Record<string, string | boolean | undefined> = {};
  if (isPlistDict(parsed)) {
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" || typeof value === "boolean") values[key] = value;
    }
  }
  return { path: rel, values };
}

function readMetadata(root: string, warnings: string[]): AppMetadata | undefined {
  const file = join(root, "shiproof.metadata.json");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return undefined; // optional file
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as AppMetadata;
    warnings.push("shiproof.metadata.json is not a JSON object; ignoring.");
    return undefined;
  } catch (err) {
    warnings.push(`Could not parse shiproof.metadata.json: ${errText(err)}`);
    return undefined;
  }
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Walk a project directory and build a parsed snapshot for the engine. */
export function scanProject(root: string): ScanResult {
  const collector: Collector = {
    root,
    sourceFiles: [],
    privacyManifests: [],
    infoPlists: [],
    warnings: [],
  };
  walk(root, collector);
  const metadata = readMetadata(root, collector.warnings);
  return {
    snapshot: {
      sourceFiles: collector.sourceFiles,
      privacyManifests: collector.privacyManifests,
      infoPlists: collector.infoPlists,
      ...(metadata ? { metadata } : {}),
    },
    warnings: collector.warnings,
  };
}
