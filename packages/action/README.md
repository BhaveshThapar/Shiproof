# AeroDeploy Pre-flight — GitHub Action

Catch the mechanical App Store rejection causes (privacy manifest, required-reason APIs,
PII usage descriptions, metadata) on **every pull request**, before you ever submit to
App Store Connect.

This is a thin composite wrapper around [`@aerodeploy/cli`](https://www.npmjs.com/package/@aerodeploy/cli):
it runs the CLI on your project, writes the report to the job summary, and fails the check
when a finding at or above your threshold exists. Deterministic and offline — no LLM, no
network, no secrets required.

## Usage

```yaml
name: App Store pre-flight
on: pull_request
jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: BhaveshThapar/AeroDeploy/packages/action@v0.1.0
        with:
          path: .
          fail-on: error
```

Pin to a release tag (e.g. `@v0.1.0`) for reproducible runs.

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | Path to the iOS project to scan. |
| `fail-on` | `error` | Fail the check when a finding at this severity or above exists (`error` \| `warning` \| `info`). |
| `min-severity` | `info` | Lowest severity to report (`error` \| `warning` \| `info`). |
| `version` | `^0.1.0` | npm version range of `@aerodeploy/cli` to run. |

## What you get

- A **`## AeroDeploy pre-flight`** section in the job summary (`$GITHUB_STEP_SUMMARY`) with
  the full human-readable report.
- A **non-zero exit** (failing the check) when any finding meets `fail-on`, so it gates the
  PR like any other required check.

## License

MIT.
