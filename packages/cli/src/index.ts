#!/usr/bin/env node
import { runPreflight, type Finding, type PreflightResult, type Severity } from "@aerodeploy/preflight-engine";
import { scanProject } from "./scan.js";

type CliOptions = {
  path: string;
  json: boolean;
  minSeverity: Severity;
  failOn: Severity;
};

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, error: 2 };
const SEVERITY_ICON: Record<Severity, string> = { error: "✖", warning: "▲", info: "ℹ" };

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { path: ".", json: false, minSeverity: "info", failOn: "error" };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith("--min-severity=")) {
      options.minSeverity = parseSeverity(arg.split("=")[1], "--min-severity");
    } else if (arg.startsWith("--fail-on=")) {
      options.failOn = parseSeverity(arg.split("=")[1], "--fail-on");
    } else if (!arg.startsWith("-")) {
      options.path = arg;
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function parseSeverity(value: string | undefined, flag: string): Severity {
  if (value === "error" || value === "warning" || value === "info") return value;
  fail(`${flag} must be one of: error, warning, info`);
}

function fail(message: string): never {
  process.stderr.write(`aerodeploy: ${message}\n`);
  process.exit(2);
}

function printHelp(): void {
  process.stdout.write(
    [
      "aerodeploy — pre-flight your iOS app for mechanical App Store rejection causes",
      "",
      "Usage: aerodeploy [path] [options]",
      "",
      "Options:",
      "  --json                 Output machine-readable JSON",
      "  --min-severity=LEVEL   Only show findings at LEVEL or above (error|warning|info)",
      "  --fail-on=LEVEL        Exit non-zero when a finding at LEVEL or above exists (default: error)",
      "  -h, --help             Show this help",
      "",
      "Exit codes: 0 clean, 1 findings at/above --fail-on, 2 usage error.",
      "",
    ].join("\n"),
  );
}

function formatHuman(result: PreflightResult, warnings: string[], path: string): string {
  const lines: string[] = [];
  lines.push(`AeroDeploy pre-flight — ${path}`);
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("✓ No mechanical rejection causes found.");
  } else {
    for (const finding of orderBySeverity(result.findings)) {
      lines.push(`${SEVERITY_ICON[finding.severity]} [${finding.severity}] ${finding.title}`);
      if (finding.location) {
        const loc = finding.location.line ? `${finding.location.file}:${finding.location.line}` : finding.location.file;
        lines.push(`    at ${loc}`);
      }
      lines.push(`    ${finding.detail}`);
      lines.push(`    fix: ${finding.fix}`);
      lines.push(`    ref: ${finding.guideline.code} — ${finding.guideline.url}`);
      lines.push("");
    }
  }

  lines.push(
    `Summary: ${result.summary.error} error, ${result.summary.warning} warning, ${result.summary.info} info`,
  );
  for (const warning of warnings) lines.push(`note: ${warning}`);
  return lines.join("\n");
}

function orderBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

function shouldFail(result: PreflightResult, failOn: Severity): boolean {
  const threshold = SEVERITY_RANK[failOn];
  return result.findings.some((f) => SEVERITY_RANK[f.severity] >= threshold);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const { snapshot, warnings } = scanProject(options.path);
  const result = runPreflight(snapshot, { minSeverity: options.minSeverity });

  if (options.json) {
    process.stdout.write(JSON.stringify({ ...result, warnings }, null, 2) + "\n");
  } else {
    process.stdout.write(formatHuman(result, warnings, options.path) + "\n");
  }

  process.exit(shouldFail(result, options.failOn) ? 1 : 0);
}

main();
