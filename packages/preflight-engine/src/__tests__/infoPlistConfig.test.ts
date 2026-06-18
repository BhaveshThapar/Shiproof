import { test } from "node:test";
import assert from "node:assert/strict";
import { scanInfoPlistConfig } from "../checks/infoPlistConfig.js";
import type { InfoPlist, ProjectSnapshot } from "../types.js";

function withPlists(...plists: InfoPlist[]): ProjectSnapshot {
  return { sourceFiles: [], privacyManifests: [], infoPlists: plists };
}

const COMPLETE: InfoPlist = {
  path: "App/Info.plist",
  values: {
    CFBundleIdentifier: "com.acme.receipts",
    CFBundleShortVersionString: "1.2.0",
    ITSAppUsesNonExemptEncryption: false,
  },
};

test("no findings when config is complete", () => {
  assert.deepEqual(scanInfoPlistConfig(withPlists(COMPLETE)), []);
});

test("no findings when there are no Info.plists at all", () => {
  assert.deepEqual(scanInfoPlistConfig(withPlists()), []);
});

test("errors on missing bundle id and missing version", () => {
  const findings = scanInfoPlistConfig(withPlists({ path: "Info.plist", values: {} }));
  const titles = findings.map((f) => f.title);
  assert.ok(titles.includes("Missing bundle identifier"));
  assert.ok(titles.includes("Missing marketing version"));
  assert.ok(findings.filter((f) => f.severity === "error").length >= 2);
});

test("warns on a placeholder bundle id", () => {
  const findings = scanInfoPlistConfig(
    withPlists({ path: "Info.plist", values: { CFBundleIdentifier: "com.example.app", CFBundleShortVersionString: "1.0" } }),
  );
  assert.ok(findings.some((f) => f.title === "Placeholder bundle identifier" && f.severity === "warning"));
});

test("info when export-compliance key is absent", () => {
  const findings = scanInfoPlistConfig(
    withPlists({ path: "Info.plist", values: { CFBundleIdentifier: "com.acme.app", CFBundleShortVersionString: "1.0" } }),
  );
  assert.ok(findings.some((f) => f.severity === "info" && /export-compliance/i.test(f.title)));
});

test("treats a key as present if any Info.plist declares it", () => {
  const findings = scanInfoPlistConfig(
    withPlists(
      { path: "App/Info.plist", values: { CFBundleIdentifier: "com.acme.app" } },
      { path: "Tests/Info.plist", values: { CFBundleShortVersionString: "1.0", ITSAppUsesNonExemptEncryption: false } },
    ),
  );
  assert.equal(findings.filter((f) => f.severity === "error").length, 0);
});
