import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectSnapshot } from "@aerodeploy/preflight-engine";
import { buildIntakePayload } from "../report.js";

const META = { appId: "app1", submissionId: "N1", buildNumber: "2", commitSha: "def" };

function snapshot(partial: Partial<ProjectSnapshot>): ProjectSnapshot {
  return { sourceFiles: [], privacyManifests: [], infoPlists: [], ...partial };
}

test("hashes each source file and is deterministic", () => {
  const snap = snapshot({ sourceFiles: [{ path: "A.swift", content: "let x = 1" }] });
  const a = buildIntakePayload(snap, META);
  const b = buildIntakePayload(snap, META);
  assert.deepEqual(Object.keys(a.fileHashes), ["A.swift"]);
  assert.equal(a.fileHashes["A.swift"], b.fileHashes["A.swift"]);
  assert.equal(a.fileHashes["A.swift"]?.length, 64); // sha256 hex
});

test("different content produces a different file hash and artifact hash", () => {
  const a = buildIntakePayload(
    snapshot({ sourceFiles: [{ path: "A.swift", content: "v1" }] }),
    META,
  );
  const b = buildIntakePayload(
    snapshot({ sourceFiles: [{ path: "A.swift", content: "v2" }] }),
    META,
  );
  assert.notEqual(a.fileHashes["A.swift"], b.fileHashes["A.swift"]);
  assert.notEqual(a.artifactHash, b.artifactHash);
});

test("includes manifest and metadata hashes only when present", () => {
  const bare = buildIntakePayload(snapshot({}), META);
  assert.equal(bare.manifestHash, undefined);
  assert.equal(bare.metadataHash, undefined);

  const rich = buildIntakePayload(
    snapshot({
      privacyManifests: [{ path: "PrivacyInfo.xcprivacy", accessedApiTypes: [] }],
      metadata: { description: "An app." },
    }),
    META,
  );
  assert.equal(typeof rich.manifestHash, "string");
  assert.equal(typeof rich.metadataHash, "string");
});

test("carries the build metadata and predicted reasons", () => {
  const payload = buildIntakePayload(snapshot({}), {
    ...META,
    predictedReasons: ["required-reason-api"],
  });
  assert.equal(payload.appId, "app1");
  assert.equal(payload.submissionId, "N1");
  assert.deepEqual(payload.predictedReasons, ["required-reason-api"]);
});
