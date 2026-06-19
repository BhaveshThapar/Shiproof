import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateActionYml, MARKETPLACE_BRANDING_COLORS } from "../actionYml.js";

/** The real action manifest, resolved from the compiled test (dist/__tests__ → repo). */
const ACTION_YML = fileURLToPath(new URL("../../../action/action.yml", import.meta.url));

test("the shipped action.yml passes the Marketplace metadata check", () => {
  const yaml = readFileSync(ACTION_YML, "utf8");
  assert.deepEqual(validateActionYml(yaml), []);
});

test("a disallowed branding.color is rejected", () => {
  const yaml = [
    'name: "X"',
    'description: "Y"',
    "branding:",
    '  icon: "check-circle"',
    '  color: "teal"', // not in the allowlist
    "runs:",
    '  using: "composite"',
  ].join("\n");
  const problems = validateActionYml(yaml);
  assert.ok(problems.some((p) => p.includes("branding.color")));
});

test("missing required fields are reported", () => {
  const problems = validateActionYml('runs:\n  using: "composite"\n');
  assert.ok(problems.some((p) => p.includes("`name`")));
  assert.ok(problems.some((p) => p.includes("`description`")));
  assert.ok(problems.some((p) => p.includes("branding.icon")));
  assert.ok(problems.some((p) => p.includes("branding.color")));
});

test("every allowlisted colour is accepted under otherwise-valid metadata", () => {
  for (const color of MARKETPLACE_BRANDING_COLORS) {
    const yaml = [
      'name: "X"',
      'description: "Y"',
      "branding:",
      '  icon: "check-circle"',
      `  color: "${color}"`,
      "runs:",
      '  using: "composite"',
    ].join("\n");
    assert.deepEqual(validateActionYml(yaml), [], `color ${color} should be valid`);
  }
});
