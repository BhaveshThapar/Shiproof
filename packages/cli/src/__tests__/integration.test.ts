import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { runPreflight } from "@shiproof/preflight-engine";
import { scanProject } from "../scan.js";

// Fixtures live outside src/ so tsc never compiles them. Resolve relative to the
// compiled test location (dist/__tests__) up to the package root.
function fixture(name: string): string {
  return fileURLToPath(new URL(`../../test-fixtures/${name}`, import.meta.url));
}

test("clean-app fixture produces zero findings end to end", () => {
  const { snapshot, warnings } = scanProject(fixture("clean-app"));
  assert.deepEqual(warnings, []);
  const result = runPreflight(snapshot);
  assert.deepEqual(
    result.findings,
    [],
    `expected clean app but got: ${result.findings.map((f) => f.title).join(", ")}`,
  );
});

test("dirty-app fixture surfaces every expected mechanical cause", () => {
  const { snapshot } = scanProject(fixture("dirty-app"));
  const result = runPreflight(snapshot);
  const checkIds = new Set(result.findings.map((f) => f.checkId));

  assert.ok(checkIds.has("required-reason-api"), "undeclared UserDefaults");
  assert.ok(checkIds.has("purpose-string"), "missing location usage description");
  assert.ok(checkIds.has("info-plist-config"), "placeholder bundle id / missing version");
  assert.ok(checkIds.has("metadata-placeholder"), "TODO placeholder in description");
  assert.ok(checkIds.has("metadata-other-platform"), "Android mention");
  assert.ok(checkIds.has("metadata-privacy-policy"), "empty privacy policy url");
  assert.ok(checkIds.has("metadata-invalid-url"), "invalid support url");

  assert.ok(
    result.summary.error >= 4,
    `expected several blocking errors, got ${result.summary.error}`,
  );
});
