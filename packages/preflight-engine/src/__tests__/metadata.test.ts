import { test } from "node:test";
import assert from "node:assert/strict";
import { lintMetadata } from "../checks/metadata.js";
import type { AppMetadata } from "../types.js";

const VALID: AppMetadata = {
  name: "Receipts",
  description: "Scan and organize your receipts.",
  privacyPolicyUrl: "https://example.com/privacy",
  supportUrl: "https://example.com/support",
};

test("clean metadata produces no findings", () => {
  assert.deepEqual(lintMetadata(VALID), []);
});

test("undefined metadata produces no findings", () => {
  assert.deepEqual(lintMetadata(undefined), []);
});

test("flags placeholder text in the description", () => {
  const findings = lintMetadata({ ...VALID, description: "Lorem ipsum dolor sit amet." });
  assert.ok(findings.some((f) => f.checkId === "metadata-placeholder" && f.severity === "error"));
});

test('does not flag legitimate "placeholder text" copy as a placeholder', () => {
  const findings = lintMetadata({
    ...VALID,
    description: "Start new items with customizable placeholder text so lists never look empty.",
  });
  assert.ok(!findings.some((f) => f.checkId === "metadata-placeholder"));
});

test("flags a leftover localhost reference in the description", () => {
  const findings = lintMetadata({ ...VALID, description: "Connect to http://localhost to begin." });
  assert.ok(findings.some((f) => f.checkId === "metadata-placeholder" && f.severity === "error"));
});

test("flags a missing privacy policy url", () => {
  const findings = lintMetadata({ ...VALID, privacyPolicyUrl: "" });
  assert.ok(
    findings.some((f) => f.checkId === "metadata-privacy-policy" && f.severity === "error"),
  );
});

test("warns on an Android mention in the description", () => {
  const findings = lintMetadata({ ...VALID, description: "Also available on Android devices." });
  assert.ok(
    findings.some((f) => f.checkId === "metadata-other-platform" && f.severity === "warning"),
  );
});

test("flags an invalid support url", () => {
  const findings = lintMetadata({ ...VALID, supportUrl: "not a url" });
  assert.ok(findings.some((f) => f.checkId === "metadata-invalid-url"));
});

test("accepts http and https but rejects ftp", () => {
  assert.equal(lintMetadata({ ...VALID, marketingUrl: "http://ok.com" }).length, 0);
  const ftp = lintMetadata({ ...VALID, marketingUrl: "ftp://nope.com" });
  assert.ok(ftp.some((f) => f.checkId === "metadata-invalid-url"));
});
