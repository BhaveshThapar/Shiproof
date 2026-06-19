import type { Finding, InfoPlist, ProjectSnapshot } from "../types.js";
import { GUIDELINES } from "../guidelines.js";

/**
 * Info.plist configuration checks: the deterministic "your build won't even get
 * out the door" causes — missing bundle identifier or marketing version, an
 * obvious placeholder bundle id, or a missing export-compliance declaration.
 *
 * Evaluated across all Info.plists in the project: a key counts as present if
 * ANY Info.plist declares it (avoids false positives from test-bundle plists).
 */

const PLACEHOLDER_BUNDLE_ID = /^(com\.(example|yourcompany|test|mycompany|domainname)\b|MyApp\b)/i;

function firstNonEmpty(
  plists: InfoPlist[],
  key: string,
): { plist: InfoPlist; value: string } | undefined {
  for (const plist of plists) {
    const value = plist.values[key];
    if (typeof value === "string" && value.trim().length > 0) return { plist, value };
  }
  return undefined;
}

function anyDeclares(plists: InfoPlist[], key: string): boolean {
  return plists.some((plist) => plist.values[key] !== undefined);
}

export function scanInfoPlistConfig(snapshot: ProjectSnapshot): Finding[] {
  const plists = snapshot.infoPlists;
  if (plists.length === 0) return [];
  const findings: Finding[] = [];

  const bundleId = firstNonEmpty(plists, "CFBundleIdentifier");
  if (!bundleId) {
    findings.push({
      checkId: "info-plist-config",
      severity: "error",
      title: "Missing bundle identifier",
      detail:
        "No Info.plist declares a non-empty CFBundleIdentifier. The build cannot be uploaded without one.",
      fix: "Set CFBundleIdentifier (reverse-DNS, e.g. com.yourbrand.app) in your app target's Info.plist or build settings.",
      guideline: GUIDELINES.accurateMetadata,
    });
  } else if (PLACEHOLDER_BUNDLE_ID.test(bundleId.value)) {
    findings.push({
      checkId: "info-plist-config",
      severity: "warning",
      title: "Placeholder bundle identifier",
      detail: `CFBundleIdentifier is "${bundleId.value}", which looks like a template default. Apple rejects placeholder identifiers.`,
      fix: "Change CFBundleIdentifier to your real reverse-DNS identifier before submitting.",
      guideline: GUIDELINES.accurateMetadata,
      location: { file: bundleId.plist.path },
    });
  }

  if (!firstNonEmpty(plists, "CFBundleShortVersionString")) {
    findings.push({
      checkId: "info-plist-config",
      severity: "error",
      title: "Missing marketing version",
      detail:
        "No Info.plist declares CFBundleShortVersionString. App Store Connect requires a marketing version (e.g. 1.0.0).",
      fix: "Add CFBundleShortVersionString (your public version, e.g. 1.0.0) to the app target's Info.plist.",
      guideline: GUIDELINES.accurateMetadata,
    });
  }

  if (!anyDeclares(plists, "ITSAppUsesNonExemptEncryption")) {
    findings.push({
      checkId: "info-plist-config",
      severity: "info",
      title: "Export-compliance key not declared",
      detail:
        "ITSAppUsesNonExemptEncryption is not set. App Store Connect will block each submission with an export-compliance question until you answer it.",
      fix: "Add ITSAppUsesNonExemptEncryption (true/false) to Info.plist to skip the manual export-compliance prompt on every upload.",
      guideline: GUIDELINES.accurateMetadata,
    });
  }

  return findings;
}
