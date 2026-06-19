import { test } from "node:test";
import assert from "node:assert/strict";
import { scanRequiredReasonApis } from "../checks/requiredReasonApi.js";
import type { ProjectSnapshot } from "../types.js";

function snapshot(partial: Partial<ProjectSnapshot>): ProjectSnapshot {
  return {
    sourceFiles: [],
    privacyManifests: [],
    infoPlists: [],
    ...partial,
  };
}

test("flags UserDefaults usage with no privacy manifest", () => {
  const findings = scanRequiredReasonApis(
    snapshot({
      sourceFiles: [
        {
          path: "Sources/Store.swift",
          content: 'let d = UserDefaults.standard\nd.set(1, forKey: "x")',
        },
      ],
    }),
  );
  assert.equal(findings.length, 1);
  const finding = findings[0];
  assert.ok(finding);
  assert.equal(finding.severity, "error");
  assert.equal(finding.checkId, "required-reason-api");
  assert.match(finding.fix, /CA92\.1/);
  assert.deepEqual(finding.location, { file: "Sources/Store.swift", line: 1 });
});

test("passes when the category is declared with an approved reason", () => {
  const findings = scanRequiredReasonApis(
    snapshot({
      sourceFiles: [{ path: "Store.swift", content: "UserDefaults.standard.bool(forKey: k)" }],
      privacyManifests: [
        {
          path: "PrivacyInfo.xcprivacy",
          accessedApiTypes: [
            { category: "NSPrivacyAccessedAPICategoryUserDefaults", reasons: ["CA92.1"] },
          ],
        },
      ],
    }),
  );
  assert.equal(findings.length, 0);
});

test("warns when declared with no reason code", () => {
  const findings = scanRequiredReasonApis(
    snapshot({
      sourceFiles: [{ path: "Store.swift", content: "UserDefaults.standard" }],
      privacyManifests: [
        {
          path: "PrivacyInfo.xcprivacy",
          accessedApiTypes: [{ category: "NSPrivacyAccessedAPICategoryUserDefaults", reasons: [] }],
        },
      ],
    }),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "warning");
});

test("warns when declared with an unapproved reason code", () => {
  const findings = scanRequiredReasonApis(
    snapshot({
      sourceFiles: [{ path: "Store.swift", content: "UserDefaults.standard" }],
      privacyManifests: [
        {
          path: "PrivacyInfo.xcprivacy",
          accessedApiTypes: [
            { category: "NSPrivacyAccessedAPICategoryUserDefaults", reasons: ["9999.9"] },
          ],
        },
      ],
    }),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "warning");
  assert.match(findings[0]?.detail ?? "", /9999\.9/);
});

test("detects boot time and disk space separately", () => {
  const findings = scanRequiredReasonApis(
    snapshot({
      sourceFiles: [
        { path: "A.swift", content: "ProcessInfo.processInfo.systemUptime" },
        { path: "B.swift", content: "url.resourceValues(forKeys: [.volumeAvailableCapacityKey])" },
      ],
    }),
  );
  const categories = findings.map((f) => f.title).sort();
  assert.equal(findings.length, 2);
  assert.match(categories[0] ?? "", /Disk space|System boot time/);
});

test("ignores non-source files", () => {
  const findings = scanRequiredReasonApis(
    snapshot({
      sourceFiles: [{ path: "README.md", content: "We call UserDefaults internally." }],
    }),
  );
  assert.equal(findings.length, 0);
});

test("returns nothing on an empty project", () => {
  assert.deepEqual(scanRequiredReasonApis(snapshot({})), []);
});
