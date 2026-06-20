# Shiproof Pre-flight

Catch the mechanical App Store rejection causes **before** you submit — on every pull
request, in under 10 minutes to install, no account migration.

This is the free, open-source wedge of [Shiproof](./plan.md): a deterministic rules
engine that flags the high-frequency, mechanical rejection causes Apple's automated
review keeps catching in 2026:

- **Required-reason APIs** used without a matching `PrivacyInfo.xcprivacy` declaration
  (UserDefaults, file timestamp, system boot time, disk space, active keyboards).
- **Missing PII usage descriptions** in `Info.plist` (camera, location, contacts,
  tracking, and more) that crash the app and get it rejected.
- **Metadata problems**: placeholder text, broken URLs, missing privacy policy,
  other-platform mentions.

Every check is deterministic and high-precision — no LLM, no network, no telemetry in
this package. It either found a real, citable problem or it didn't.

## Packages

| Package                                                     | What it is                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`@shiproof/preflight-engine`](./packages/preflight-engine) | Pure rules engine. Takes a parsed project snapshot, returns findings. Fully unit-tested. |
| [`@shiproof/cli`](./packages/cli)                           | `shiproof` CLI. Scans a directory, runs the engine, prints findings (human or `--json`). |
| [`packages/action`](./packages/action)                      | The GitHub Action wrapper that runs the CLI on every PR.                                 |

The deterministic engine is intentionally a standalone OSS package so the free Action
and the paid Shiproof backend share **one** engine and **one** test suite, while the
corpus / prediction / appeal logic stays in a separate private codebase.

## Use it as a GitHub Action

```yaml
# .github/workflows/preflight.yml
name: Shiproof pre-flight
on: [pull_request]
jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shiproof/preflight-action@v1
        with:
          path: .
          fail-on: error
```

## Use it as a CLI

```bash
npx @shiproof/cli .                 # scan the current directory
npx @shiproof/cli ./MyApp --json    # machine-readable output
npx @shiproof/cli . --fail-on=warning
```

Exit codes: `0` clean, `1` findings at/above `--fail-on`, `2` usage error.

### Optional: report builds to an Shiproof backend

The checker works fully offline. If you also use the paid Shiproof backend, the
CLI can report each build's fingerprint at pre-flight so the backend can later
learn which fix resolved a rejection. It's strictly opt-in and never changes the
exit code:

```bash
SHIPROOF_API_KEY=... SHIPROOF_REPORT_URL=https://api.your-shiproof \
  npx @shiproof/cli . --app-id=<asc-app-id> --submission-id=<version-id>
```

The API key is read only from the environment (never a flag). Nothing is reported
unless `--report-url`, the API key, `--app-id`, and `--submission-id` are all set.

### Optional: metadata linting

Drop an `shiproof.metadata.json` at your project root (or export it from App Store
Connect) to lint your listing copy too:

```json
{
  "description": "Scan and organize your receipts.",
  "releaseNotes": "Bug fixes.",
  "privacyPolicyUrl": "https://example.com/privacy",
  "supportUrl": "https://example.com/support"
}
```

## Develop

```bash
npm install
npm run build      # tsc -b across the workspace
npm test           # build + Node's test runner (zero extra deps)
npm run typecheck
```

Requires Node 20+. MIT licensed.
