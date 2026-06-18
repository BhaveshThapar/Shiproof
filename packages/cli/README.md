# @aerodeploy/cli

Pre-flight your iOS project for the high-frequency **mechanical** App Store rejection
causes — privacy manifest gaps, required-reason APIs, missing PII usage descriptions, and
metadata problems — *before* you submit. Deterministic, high-precision, runs fully offline.

The CLI is the I/O layer around [`@aerodeploy/preflight-engine`](https://www.npmjs.com/package/@aerodeploy/preflight-engine):
it walks a directory, parses `PrivacyInfo.xcprivacy`, `Info.plist`, and metadata into a
snapshot, runs the pure engine, and prints findings.

## Install

```sh
# one-off, no install
npx @aerodeploy/cli .

# or install globally
npm install -g @aerodeploy/cli
aerodeploy .
```

Requires Node ≥20.

## Usage

```sh
aerodeploy [path] [options]
```

```
Options:
  --json                 Output machine-readable JSON
  --min-severity=LEVEL   Only show findings at LEVEL or above (error|warning|info)
  --fail-on=LEVEL        Exit non-zero when a finding at LEVEL or above exists (default: error)
  -h, --help             Show this help
```

Examples:

```sh
aerodeploy ./MyApp                      # human-readable report, fails on errors
aerodeploy ./MyApp --json               # machine-readable for CI
aerodeploy ./MyApp --min-severity=warning --fail-on=warning
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Clean — no findings at or above `--fail-on`. |
| `1` | One or more findings at or above `--fail-on`. |
| `2` | Usage error (bad flag or bad severity value). |

This makes it drop-in for CI: a non-zero exit fails the job.

## What it scans

Walking `path`, the CLI parses and checks:

- `PrivacyInfo.xcprivacy` — required-reason API declarations.
- `Info.plist` — PII usage descriptions, bundle id, version, export compliance.
- `aerodeploy.metadata.json` — App Store metadata (placeholder text, other-platform
  mentions, privacy-policy URL).

Binary plists are rejected with a note; convert to XML (`plutil -convert xml1`).

## CI / GitHub Action

For pull requests, use the GitHub Action wrapper
([`packages/action`](../action/README.md)) which runs this CLI on every PR and writes the
report to the job summary.

## Opt-in corpus reporting

The CLI can optionally report a build fingerprint to an AeroDeploy backend
(`--report-url`, with `$AERODEPLOY_API_KEY`, `--app-id`, `--submission-id`). This is
**strictly opt-in**, off by default, and **never changes the exit code** — the checker
always works fully offline. The API key is read only from the environment, never from a
flag, so it can't leak into process listings. Run `aerodeploy --help` for the full list.

## License

MIT.
