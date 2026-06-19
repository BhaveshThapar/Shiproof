import { test } from "node:test";
import assert from "node:assert/strict";
import { runPreflight, hasBlockingFindings } from "../engine.js";
import type { ProjectSnapshot } from "../types.js";

const DIRTY: ProjectSnapshot = {
  sourceFiles: [
    { path: "App/Store.swift", content: 'UserDefaults.standard.set(true, forKey: "seen")' },
    { path: "App/Cam.swift", content: "let s = AVCaptureSession()" },
  ],
  privacyManifests: [],
  infoPlists: [],
  metadata: {
    description: "TODO write a real description",
    privacyPolicyUrl: "",
  },
};

test("aggregates findings from every check", () => {
  const result = runPreflight(DIRTY);
  const checkIds = new Set(result.findings.map((f) => f.checkId));
  assert.ok(checkIds.has("required-reason-api"));
  assert.ok(checkIds.has("purpose-string"));
  assert.ok(checkIds.has("metadata-placeholder"));
  assert.ok(checkIds.has("metadata-privacy-policy"));
});

test("summary tallies severities and blocking flag is set", () => {
  const result = runPreflight(DIRTY);
  const total = result.summary.error + result.summary.warning + result.summary.info;
  assert.equal(total, result.findings.length);
  assert.ok(result.summary.error > 0);
  assert.equal(hasBlockingFindings(result), true);
});

test("minSeverity=error filters out warnings", () => {
  const snapshot: ProjectSnapshot = {
    sourceFiles: [{ path: "S.swift", content: "UserDefaults.standard" }],
    privacyManifests: [
      {
        path: "PrivacyInfo.xcprivacy",
        accessedApiTypes: [{ category: "NSPrivacyAccessedAPICategoryUserDefaults", reasons: [] }],
      },
    ],
    infoPlists: [],
    metadata: { privacyPolicyUrl: "https://example.com/p" },
  };
  const all = runPreflight(snapshot);
  assert.ok(all.summary.warning > 0);
  const errorsOnly = runPreflight(snapshot, { minSeverity: "error" });
  assert.equal(errorsOnly.summary.warning, 0);
  assert.equal(errorsOnly.findings.length, all.summary.error);
});

test("a clean project passes with no blocking findings", () => {
  const clean: ProjectSnapshot = {
    sourceFiles: [{ path: "Math.swift", content: "let x = 1 + 1" }],
    privacyManifests: [],
    infoPlists: [],
    metadata: {
      description: "A simple calculator.",
      privacyPolicyUrl: "https://example.com/privacy",
    },
  };
  const result = runPreflight(clean);
  assert.deepEqual(result.findings, []);
  assert.equal(hasBlockingFindings(result), false);
});
