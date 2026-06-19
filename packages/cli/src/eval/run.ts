import { evaluate, type EvalReport } from "./evaluate.js";

/**
 * Human-readable precision/recall report over the eval corpus. Run via
 * `npm run eval` from the repo root. Exits non-zero on any budget miss so it
 * doubles as a CI gate.
 */
function format(report: EvalReport): string {
  const lines: string[] = ["AeroDeploy pre-flight — precision eval", ""];

  for (const app of report.apps) {
    if (app.kind === "clean") {
      const ok = app.falsePositives.length === 0;
      lines.push(`${ok ? "✓" : "✗"} ${pad(app.app)} clean   ${app.findings.length} findings`);
      for (const f of app.falsePositives) {
        lines.push(`    FALSE POSITIVE  [${f.checkId}] ${f.title}`);
      }
    } else {
      const ok = app.missingCheckIds.length === 0 && app.errorShortfall === 0;
      const detected = app.findings.map((f) => f.checkId);
      lines.push(
        `${ok ? "✓" : "✗"} ${pad(app.app)} dirty   detected: ${unique(detected).join(", ") || "none"}`,
      );
      for (const id of app.missingCheckIds) {
        lines.push(`    MISSED          expected [${id}] but it did not fire`);
      }
      if (app.errorShortfall > 0) {
        lines.push(
          `    MISSED          expected more blocking findings (short by ${app.errorShortfall})`,
        );
      }
    }
  }

  lines.push("");
  lines.push(
    `Precision: ${report.cleanApps} clean apps, ${report.falsePositives} false positives` +
      (report.falsePositives === 0 ? " ✓" : " ✗"),
  );
  lines.push(
    `Recall:    ${report.dirtyApps} dirty apps, ${report.falseNegatives} false negatives` +
      (report.falseNegatives === 0 ? " ✓" : " ✗"),
  );
  return lines.join("\n");
}

function pad(s: string): string {
  return s.padEnd(24, " ");
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

const report = evaluate();
console.log(format(report));
if (!report.ok) {
  console.error(
    "\nPrecision eval failed: the engine has a false positive or missed a known cause.",
  );
  process.exit(1);
}
