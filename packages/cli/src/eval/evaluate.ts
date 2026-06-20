import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPreflight, type Finding } from "@shiproof/preflight-engine";
import { scanProject } from "../scan.js";

/**
 * Precision/recall evaluation over the `eval-corpus/` fixtures.
 *
 * Pure of any I/O beyond reading the corpus: it scans each fixture, runs the
 * engine, and scores it against `expected.json`. No printing, no process.exit —
 * both the `npm run eval` report and the CI precision test consume this.
 *
 *   clean app  → must produce ZERO findings        (a finding = false positive)
 *   dirty app  → must surface every expected check  (a miss   = false negative)
 *                and at least `minErrors` blocking findings
 */

export type CleanExpectation = { kind: "clean" };
export type DirtyExpectation = {
  kind: "dirty";
  /** checkIds that MUST appear among the findings. */
  expectCheckIds: string[];
  /** minimum number of error-severity findings expected. */
  minErrors: number;
};
export type Expectation = CleanExpectation | DirtyExpectation;

export type AppResult = {
  app: string;
  kind: "clean" | "dirty";
  findings: Finding[];
  warnings: string[];
  /** clean apps: every finding is a false positive. */
  falsePositives: Finding[];
  /** dirty apps: expected checkIds that did not fire. */
  missingCheckIds: string[];
  /** dirty apps: how many error findings short of `minErrors`. */
  errorShortfall: number;
};

export type EvalReport = {
  apps: AppResult[];
  cleanApps: number;
  dirtyApps: number;
  /** total false positives across all clean apps. */
  falsePositives: number;
  /** total missing checks + error shortfalls across all dirty apps. */
  falseNegatives: number;
  ok: boolean;
};

/** Corpus dir resolved relative to the compiled file (dist/eval → package root). */
export const DEFAULT_CORPUS_DIR = fileURLToPath(new URL("../../eval-corpus", import.meta.url));

export function evaluate(corpusDir: string = DEFAULT_CORPUS_DIR): EvalReport {
  const expected = readExpected(join(corpusDir, "expected.json"));
  const apps: AppResult[] = [];

  for (const [app, exp] of Object.entries(expected)) {
    const { snapshot, warnings } = scanProject(join(corpusDir, app));
    const { findings } = runPreflight(snapshot);

    if (exp.kind === "clean") {
      apps.push({
        app,
        kind: "clean",
        findings,
        warnings,
        falsePositives: findings,
        missingCheckIds: [],
        errorShortfall: 0,
      });
      continue;
    }

    const present = new Set(findings.map((f) => f.checkId));
    const missingCheckIds = exp.expectCheckIds.filter((id) => !present.has(id));
    const errors = findings.filter((f) => f.severity === "error").length;
    apps.push({
      app,
      kind: "dirty",
      findings,
      warnings,
      falsePositives: [],
      missingCheckIds,
      errorShortfall: Math.max(0, exp.minErrors - errors),
    });
  }

  const falsePositives = apps.reduce((n, a) => n + a.falsePositives.length, 0);
  const falseNegatives = apps.reduce((n, a) => n + a.missingCheckIds.length + a.errorShortfall, 0);

  return {
    apps,
    cleanApps: apps.filter((a) => a.kind === "clean").length,
    dirtyApps: apps.filter((a) => a.kind === "dirty").length,
    falsePositives,
    falseNegatives,
    ok: falsePositives === 0 && falseNegatives === 0,
  };
}

function readExpected(file: string): Record<string, Expectation> {
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Corpus expected.json must be a JSON object: ${file}`);
  }
  const out: Record<string, Expectation> = {};
  for (const [app, value] of Object.entries(raw as Record<string, unknown>)) {
    out[app] = parseExpectation(app, value);
  }
  return out;
}

function parseExpectation(app: string, value: unknown): Expectation {
  if (!value || typeof value !== "object") {
    throw new Error(`Corpus entry "${app}" must be an object.`);
  }
  const v = value as Record<string, unknown>;
  if (v.kind === "clean") return { kind: "clean" };
  if (v.kind === "dirty") {
    const expectCheckIds = Array.isArray(v.expectCheckIds)
      ? v.expectCheckIds.filter((x): x is string => typeof x === "string")
      : [];
    const minErrors = typeof v.minErrors === "number" ? v.minErrors : 0;
    return { kind: "dirty", expectCheckIds, minErrors };
  }
  throw new Error(`Corpus entry "${app}" has an unknown kind: ${String(v.kind)}`);
}
