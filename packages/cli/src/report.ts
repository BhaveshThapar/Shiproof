import { createHash } from "node:crypto";
import type { ProjectSnapshot } from "@shiproof/preflight-engine";

/**
 * Optional corpus intake: report this build's fingerprint to an Shiproof
 * backend at pre-flight. This is what lets the backend later diff build N vs N+1
 * and learn which fix flipped a rejection. It is strictly opt-in (only runs when
 * --report-url + an API key are provided) and never affects the local check's
 * exit code — the free checker works fully offline without it.
 */
export type IntakePayload = {
  appId: string;
  submissionId: string;
  buildNumber: string;
  commitSha: string;
  artifactHash: string;
  fileHashes: Record<string, string>;
  manifestHash?: string;
  infoPlistHash?: string;
  metadataHash?: string;
  predictedReasons?: string[];
};

export type ReportMeta = {
  appId: string;
  submissionId: string;
  buildNumber: string;
  commitSha: string;
  predictedReasons?: string[];
};

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function buildIntakePayload(snapshot: ProjectSnapshot, meta: ReportMeta): IntakePayload {
  const fileHashes: Record<string, string> = {};
  for (const file of snapshot.sourceFiles) fileHashes[file.path] = sha256(file.content);

  const artifactHash = sha256(
    Object.entries(fileHashes)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, hash]) => `${path}:${hash}`)
      .join("|"),
  );

  const payload: IntakePayload = {
    appId: meta.appId,
    submissionId: meta.submissionId,
    buildNumber: meta.buildNumber,
    commitSha: meta.commitSha,
    artifactHash,
    fileHashes,
  };
  if (snapshot.privacyManifests.length > 0)
    payload.manifestHash = sha256(JSON.stringify(snapshot.privacyManifests));
  if (snapshot.infoPlists.length > 0)
    payload.infoPlistHash = sha256(JSON.stringify(snapshot.infoPlists));
  if (snapshot.metadata) payload.metadataHash = sha256(JSON.stringify(snapshot.metadata));
  if (meta.predictedReasons && meta.predictedReasons.length > 0)
    payload.predictedReasons = meta.predictedReasons;
  return payload;
}

export type ReportResult = { ok: boolean; status: number };

export async function reportPreflight(
  payload: IntakePayload,
  options: { url: string; apiKey: string },
): Promise<ReportResult> {
  const endpoint = `${options.url.replace(/\/$/, "")}/intake/preflight`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status };
}
