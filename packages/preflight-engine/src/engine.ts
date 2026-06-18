import type {
  Finding,
  PreflightOptions,
  PreflightResult,
  PreflightSummary,
  ProjectSnapshot,
  Severity,
} from "./types.js";
import { scanRequiredReasonApis } from "./checks/requiredReasonApi.js";
import { scanPurposeStrings } from "./checks/pii.js";
import { scanInfoPlistConfig } from "./checks/infoPlistConfig.js";
import { lintMetadata } from "./checks/metadata.js";

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

function summarize(findings: Finding[]): PreflightSummary {
  const summary: PreflightSummary = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) summary[finding.severity]++;
  return summary;
}

/**
 * Run every deterministic pre-flight check against a parsed project snapshot.
 * Pure: no I/O, no LLM, no network. The order of checks is stable so output is
 * reproducible across runs (a property the corpus relies on downstream).
 */
export function runPreflight(
  snapshot: ProjectSnapshot,
  options: PreflightOptions = {},
): PreflightResult {
  const all: Finding[] = [
    ...scanRequiredReasonApis(snapshot),
    ...scanPurposeStrings(snapshot),
    ...scanInfoPlistConfig(snapshot),
    ...lintMetadata(snapshot.metadata),
  ];

  const min = SEVERITY_RANK[options.minSeverity ?? "info"];
  const findings = all.filter((f) => SEVERITY_RANK[f.severity] >= min);

  return { findings, summary: summarize(findings) };
}

/** True when the result contains at least one blocking (error) finding. */
export function hasBlockingFindings(result: PreflightResult): boolean {
  return result.summary.error > 0;
}
