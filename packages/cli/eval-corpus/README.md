# Precision eval corpus

A corpus of realistic iOS project trees used to measure the pre-flight engine's
**precision** (no false positives on genuinely-clean apps) and **recall** (it still
catches real mechanical rejection causes). The harness lives in
[`../src/eval/`](../src/eval/); run it with `npm run eval` from the repo root, and it is
also enforced as a hard gate by `npm test` (see `src/__tests__/precision.eval.test.ts`).

## Budget

- **Precision:** every `clean` app must produce **zero** findings. A single finding on a
  clean app fails the build — false positives are the wedge's enemy.
- **Recall:** every `dirty` app must surface each `checkId` in its `expectCheckIds` and at
  least `minErrors` blocking findings.

## Layout

Each entry is a directory the CLI can scan (same shape a real iOS repo has):

```
<app>/
  App/*.swift            source the required-reason + purpose-string checks read
  App/Info.plist         CFBundleIdentifier / version / purpose strings / export key
  App/PrivacyInfo.xcprivacy   declared required-reason APIs
  aerodeploy.metadata.json    App Store Connect listing metadata
```

`expected.json` maps each directory to its expectation:

```json
{ "<app>": { "kind": "clean" } }
{ "<app>": { "kind": "dirty", "expectCheckIds": ["purpose-string"], "minErrors": 1 } }
```

## Adding a real OSS app

Drop a real (or realistically-shaped) iOS project under a new directory, add an entry to
`expected.json`, and run `npm run eval`. For a real app you believe ships cleanly, mark it
`clean` — any finding the harness reports is either a real precision bug to fix in the
engine or a genuine issue in that app worth confirming. Keep large vendored trees out; the
checks only read `*.swift|m|mm|h|c|cc|cpp`, `Info.plist`, `*.xcprivacy`, and the metadata
file, so a trimmed subset is enough.

## Vendored real-app fixtures

`real-*` directories hold **verbatim trimmed subsets** of real, permissively-licensed
shipping iOS apps. They prove the engine's precision on real-world code: each declares a
required-reason API (`UserDefaults`) and is expected to stay silent because the vendored
`PrivacyInfo.xcprivacy` declares it with an approved reason. Only the files the scanner reads
are vendored; everything else is left upstream. Attribution + provenance:

| Fixture | Upstream repo | License | Commit | Vendored files | Label |
| --- | --- | --- | --- | --- | --- |
| `real-netnewswire-ios` | [Ranchero-Software/NetNewsWire](https://github.com/Ranchero-Software/NetNewsWire) | MIT | `b290a9d` | `iOS/AppDefaults.swift`, `iOS/Resources/PrivacyInfo.xcprivacy` | clean |
| `real-duckduckgo-ios` | [duckduckgo/iOS](https://github.com/duckduckgo/iOS) | Apache-2.0 | `7b3f601` | `Core/StatisticsUserDefaults.swift`, `DuckDuckGo/Info.plist`, `DuckDuckGo/PrivacyInfo.xcprivacy` | clean |
| `real-wikipedia-ios` | [wikimedia/wikipedia-ios](https://github.com/wikimedia/wikipedia-ios) | MIT | `cffb205` | `Wikipedia/Code/NSUserDefaults+WMFApplicationDefaults.swift`, `Wikipedia/Wikipedia-Info.plist`→`Info.plist`, `Wikipedia/Resources/PrivacyInfo.xcprivacy` | clean |

Notes: NetNewsWire's iOS target uses an Xcode-generated `Info.plist`, so none is checked in
upstream and none is vendored (the config check no-ops with no plist). Wikipedia's app plist
is named `Wikipedia-Info.plist` upstream; it is saved here as `Info.plist` — the canonical
name the scanner matches — with contents unchanged. Only MIT / Apache-2.0 / BSD apps are
vendored; the engine is MIT, so copyleft sources (GPL/AGPL/MPL) are never included.
