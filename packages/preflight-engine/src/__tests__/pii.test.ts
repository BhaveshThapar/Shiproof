import { test } from "node:test";
import assert from "node:assert/strict";
import { scanPurposeStrings } from "../checks/pii.js";
import type { ProjectSnapshot } from "../types.js";

function snapshot(partial: Partial<ProjectSnapshot>): ProjectSnapshot {
  return { sourceFiles: [], privacyManifests: [], infoPlists: [], ...partial };
}

test("flags camera use with no NSCameraUsageDescription", () => {
  const findings = scanPurposeStrings(
    snapshot({
      sourceFiles: [{ path: "Cam.swift", content: "let s = AVCaptureSession()" }],
    }),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "error");
  assert.match(findings[0]?.fix ?? "", /NSCameraUsageDescription/);
});

test("passes when the usage description is present and non-empty", () => {
  const findings = scanPurposeStrings(
    snapshot({
      sourceFiles: [{ path: "Cam.swift", content: "AVCaptureSession()" }],
      infoPlists: [
        { path: "Info.plist", values: { NSCameraUsageDescription: "Scan receipts." } },
      ],
    }),
  );
  assert.equal(findings.length, 0);
});

test("flags when the usage description exists but is empty", () => {
  const findings = scanPurposeStrings(
    snapshot({
      sourceFiles: [{ path: "Cam.swift", content: "AVCaptureSession()" }],
      infoPlists: [{ path: "Info.plist", values: { NSCameraUsageDescription: "   " } }],
    }),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "error");
});

test("flags location and tracking independently", () => {
  const findings = scanPurposeStrings(
    snapshot({
      sourceFiles: [
        { path: "Loc.swift", content: "let m = CLLocationManager()" },
        { path: "Att.swift", content: "ATTrackingManager.requestTrackingAuthorization { _ in }" },
      ],
    }),
  );
  assert.equal(findings.length, 2);
  const keys = findings.map((f) => f.title).sort();
  assert.ok(keys.some((k) => /Location/.test(k)));
  assert.ok(keys.some((k) => /tracking/i.test(k)));
});

test("returns nothing when no sensitive APIs are used", () => {
  const findings = scanPurposeStrings(
    snapshot({ sourceFiles: [{ path: "Math.swift", content: "let x = 2 + 2" }] }),
  );
  assert.equal(findings.length, 0);
});
