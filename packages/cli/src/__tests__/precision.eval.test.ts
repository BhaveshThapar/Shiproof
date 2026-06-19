import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../eval/evaluate.js";

// Enforces the precision/recall budget in the normal test/CI run, so a regression
// that re-introduces a false positive (or drops a known cause) fails `npm test`,
// not just `npm run eval`.
test("precision: no clean-app false positives, no dirty-app misses", () => {
  const report = evaluate();

  assert.ok(report.cleanApps >= 3, `expected a real clean corpus, got ${report.cleanApps} apps`);
  assert.ok(report.dirtyApps >= 2, `expected a real dirty corpus, got ${report.dirtyApps} apps`);

  const falsePositives = report.apps
    .filter((a) => a.falsePositives.length > 0)
    .map((a) => `${a.app}: ${a.falsePositives.map((f) => f.checkId).join(", ")}`);
  assert.deepEqual(
    falsePositives,
    [],
    `clean apps produced findings: ${falsePositives.join(" | ")}`,
  );

  const misses = report.apps
    .filter((a) => a.missingCheckIds.length > 0 || a.errorShortfall > 0)
    .map((a) => `${a.app}: missing ${a.missingCheckIds.join(", ")} shortfall ${a.errorShortfall}`);
  assert.deepEqual(misses, [], `dirty apps missed expected causes: ${misses.join(" | ")}`);

  assert.ok(report.ok);
});
