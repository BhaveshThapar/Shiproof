import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanProject } from "../scan.js";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "shiproof-"));
  mkdirSync(join(root, "App"));
  mkdirSync(join(root, "node_modules", "junk"), { recursive: true });

  writeFileSync(join(root, "App", "Store.swift"), 'UserDefaults.standard.set(1, forKey: "k")');
  writeFileSync(join(root, "App", "Info.plist"), INFO_PLIST);
  writeFileSync(join(root, "App", "PrivacyInfo.xcprivacy"), XCPRIVACY);
  // Should be ignored:
  writeFileSync(join(root, "node_modules", "junk", "Ignore.swift"), "AVCaptureSession()");
  writeFileSync(
    join(root, "shiproof.metadata.json"),
    JSON.stringify({ description: "A receipt scanner.", privacyPolicyUrl: "https://x.com/p" }),
  );
  return root;
}

const INFO_PLIST = `<plist><dict><key>NSCameraUsageDescription</key><string>Scan.</string></dict></plist>`;
const XCPRIVACY = `<plist><dict><key>NSPrivacyAccessedAPITypes</key><array><dict><key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryUserDefaults</string><key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string></array></dict></array></dict></plist>`;

test("builds a snapshot and skips ignored directories", () => {
  const root = fixture();
  try {
    const { snapshot, warnings } = scanProject(root);
    assert.equal(warnings.length, 0);
    assert.equal(snapshot.sourceFiles.length, 1);
    assert.match(snapshot.sourceFiles[0]?.path ?? "", /Store\.swift$/);
    assert.equal(snapshot.infoPlists.length, 1);
    assert.equal(snapshot.infoPlists[0]?.values["NSCameraUsageDescription"], "Scan.");
    assert.equal(snapshot.privacyManifests.length, 1);
    assert.deepEqual(snapshot.privacyManifests[0]?.accessedApiTypes, [
      { category: "NSPrivacyAccessedAPICategoryUserDefaults", reasons: ["CA92.1"] },
    ]);
    assert.equal(snapshot.metadata?.description, "A receipt scanner.");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("surfaces a warning for a malformed privacy manifest, does not throw", () => {
  const root = mkdtempSync(join(tmpdir(), "shiproof-"));
  try {
    writeFileSync(join(root, "Broken.xcprivacy"), "<plist><dict><key>a</key></dict></plist>");
    const { snapshot, warnings } = scanProject(root);
    assert.equal(snapshot.privacyManifests.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /malformed privacy manifest/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
