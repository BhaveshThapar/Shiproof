import type { Finding, ProjectSnapshot } from "../types.js";
import { GUIDELINES } from "../guidelines.js";
import { lineOf } from "./util.js";
import { maskComments } from "./source.js";

/**
 * Required-reason APIs (Apple): using one of these without declaring the
 * matching category + an approved reason in a PrivacyInfo.xcprivacy is a
 * top-frequency 2026 binary rejection. These are deterministic, so we catch
 * them with high precision before submission.
 *
 *   source uses API ──▶ category used ──▶ declared in a manifest?
 *                                            │ no  ──▶ ERROR (undeclared)
 *                                            │ yes, but no reason ──▶ WARNING
 *                                            └ yes + reason ──▶ ok
 */
type ReasonCategory = {
  category: string;
  label: string;
  /** Approved reason codes for this category (shown in the fix hint). */
  approvedReasons: string[];
  /** Source patterns that indicate the category is in use. */
  patterns: RegExp[];
};

export const REQUIRED_REASON_CATEGORIES: ReasonCategory[] = [
  {
    category: "NSPrivacyAccessedAPICategoryUserDefaults",
    label: "User defaults",
    approvedReasons: ["CA92.1", "1C8F.1", "C56D.1"],
    patterns: [/\bNSUserDefaults\b/, /\bUserDefaults\b/],
  },
  {
    category: "NSPrivacyAccessedAPICategoryFileTimestamp",
    label: "File timestamp",
    approvedReasons: ["DDA9.1", "C617.1", "3B52.1", "0A2A.1"],
    patterns: [
      /\bcreationDateKey\b/,
      /\bcontentModificationDateKey\b/,
      /\.fileModificationDate\b/,
      /\bNSFileModificationDate\b/,
      /\bNSFileCreationDate\b/,
      /\bgetattrlist(bulk)?\s*\(/,
      /\bf?stat(at)?\s*\(/,
      /\blstat\s*\(/,
    ],
  },
  {
    category: "NSPrivacyAccessedAPICategorySystemBootTime",
    label: "System boot time",
    approvedReasons: ["35F9.1", "8FFB.1", "3D61.1"],
    patterns: [/\bsystemUptime\b/, /\bmach_absolute_time\s*\(/],
  },
  {
    category: "NSPrivacyAccessedAPICategoryDiskSpace",
    label: "Disk space",
    approvedReasons: ["85F4.1", "E174.1", "7D9E.1", "B728.1"],
    patterns: [
      /\bvolumeAvailableCapacity(ForImportantUsage|ForOpportunisticUsage)?Key\b/,
      /\bvolumeTotalCapacityKey\b/,
      /\bsystemFreeSize\b/,
      /\bsystemSize\b/,
      /\bstatv?fs\s*\(/,
      /\bfstatv?fs\s*\(/,
    ],
  },
  {
    category: "NSPrivacyAccessedAPICategoryActiveKeyboards",
    label: "Active keyboards",
    approvedReasons: ["3EC4.1", "54BD.1"],
    patterns: [/\bactiveInputModes\b/],
  },
];

/** Source files Apple's required-reason rules apply to. */
function isAppSource(path: string): boolean {
  return /\.(swift|m|mm|h|c|cc|cpp)$/i.test(path);
}

type Usage = { category: ReasonCategory; file: string; line: number };

function firstUsages(snapshot: ProjectSnapshot): Map<string, Usage> {
  const found = new Map<string, Usage>();
  for (const file of snapshot.sourceFiles) {
    if (!isAppSource(file.path)) continue;
    const content = maskComments(file.content);
    for (const category of REQUIRED_REASON_CATEGORIES) {
      if (found.has(category.category)) continue;
      for (const pattern of category.patterns) {
        const match = pattern.exec(content);
        if (match) {
          found.set(category.category, {
            category,
            file: file.path,
            line: lineOf(content, match.index),
          });
          break;
        }
      }
    }
  }
  return found;
}

export function scanRequiredReasonApis(snapshot: ProjectSnapshot): Finding[] {
  const findings: Finding[] = [];
  const usages = firstUsages(snapshot);
  if (usages.size === 0) return findings;

  const declared = new Map<string, string[]>();
  for (const manifest of snapshot.privacyManifests) {
    for (const entry of manifest.accessedApiTypes) {
      const existing = declared.get(entry.category) ?? [];
      declared.set(entry.category, [...existing, ...entry.reasons]);
    }
  }

  for (const usage of usages.values()) {
    const cat = usage.category;
    const reasons = declared.get(cat.category);
    if (reasons === undefined) {
      findings.push({
        checkId: "required-reason-api",
        severity: "error",
        title: `Undeclared required-reason API: ${cat.label}`,
        detail: `Your code uses the ${cat.label} API (${cat.category}), but no PrivacyInfo.xcprivacy declares it. Apple rejects binaries that use a required-reason API without an approved reason.`,
        fix: `Add "${cat.category}" to NSPrivacyAccessedAPITypes in your PrivacyInfo.xcprivacy with one of the approved reasons: ${cat.approvedReasons.join(", ")}.`,
        guideline: GUIDELINES.requiredReasonApi,
        location: { file: usage.file, line: usage.line },
      });
    } else if (reasons.length === 0) {
      findings.push({
        checkId: "required-reason-api",
        severity: "warning",
        title: `${cat.label} declared without a reason code`,
        detail: `${cat.category} is listed in a privacy manifest but has no NSPrivacyAccessedAPITypeReasons. Apple requires at least one approved reason.`,
        fix: `Add a reason code to that entry. Approved values: ${cat.approvedReasons.join(", ")}.`,
        guideline: GUIDELINES.requiredReasonApi,
        location: { file: usage.file, line: usage.line },
      });
    } else {
      const invalid = reasons.filter((r) => !cat.approvedReasons.includes(r));
      if (invalid.length > 0) {
        findings.push({
          checkId: "required-reason-api",
          severity: "warning",
          title: `${cat.label} declared with an unrecognized reason`,
          detail: `${cat.category} declares reason(s) ${invalid.join(", ")}, which are not in Apple's approved list for this category.`,
          fix: `Use one of the approved reasons for ${cat.label}: ${cat.approvedReasons.join(", ")}.`,
          guideline: GUIDELINES.requiredReasonApi,
          location: { file: usage.file, line: usage.line },
        });
      }
    }
  }

  return findings;
}
