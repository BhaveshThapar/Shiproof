# @aerodeploy/preflight-engine

Pure, deterministic rules engine for the high-frequency mechanical App Store rejection
causes. No I/O, no LLM, no network — give it a parsed project snapshot, get back
findings.

```ts
import { runPreflight, type ProjectSnapshot } from "@aerodeploy/preflight-engine";

const snapshot: ProjectSnapshot = {
  sourceFiles: [{ path: "App/Store.swift", content: "UserDefaults.standard.set(1, forKey: \"k\")" }],
  privacyManifests: [],
  infoPlists: [],
  metadata: { privacyPolicyUrl: "" },
};

const result = runPreflight(snapshot);
// result.findings -> [{ checkId, severity, title, detail, fix, guideline, location? }, ...]
// result.summary  -> { error, warning, info }
```

The I/O of turning a directory into a `ProjectSnapshot` lives in `@aerodeploy/cli`, not
here. That separation keeps every check a pure function and trivially testable.

## Checks

- `required-reason-api` — required-reason API used without a matching
  `PrivacyInfo.xcprivacy` declaration / approved reason code.
- `purpose-string` — sensitive API used without its `Info.plist` usage description.
- `metadata-*` — placeholder text, other-platform mentions, missing privacy policy,
  invalid URLs.

MIT licensed.
