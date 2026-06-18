# AeroDeploy — Implementation Plan (from PRD v2.1)

## 0. What we are building, in one paragraph
A free, open-source **pre-flight GitHub Action** that deterministically catches the
mechanical App Store rejection causes (privacy manifest, required-reason APIs, PII
declarations, metadata) on every PR — the wedge — feeding a **paid approval agent**
that predicts rejections, diagnoses real rejections, and drafts evidence-backed
appeals. The defensible asset is the **outcome-verified rejection corpus**: every
`(submission → rejection → fix → outcome)` triple is confirmed against the real App
Store Connect record, not self-reported. We are the intelligence layer, never the
build compute.

## 1. Architecture (maps to PRD §7 / §13)
```
┌─────────────────────────────────────────────────────────────────┐
│  Integration layer:  GitHub Action + CLI  (read-only on repo)    │
├─────────────────────────────────────────────────────────────────┤
│  Deterministic pre-flight engine  (NO LLM — rules, high precision)│
│    bundle id · cert/profile · asset sizing · privacy manifest ·  │
│    required-reason API · PII declarations                         │
├─────────────────────────────────────────────────────────────────┤
│  LLM diagnosis & drafting engine  (RAG over corpus + guidelines) │
├─────────────────────────────────────────────────────────────────┤
│  Outcome-verification loop                                        │
│    Leg A: ASC polling (official API, ToS-safe)                    │
│    Leg B: rejection reason via user-mediated email/OCR (no scrape)│
│    Leg C: fix-delta attribution (diff N → N+1)                    │
├─────────────────────────────────────────────────────────────────┤
│  Rejection corpus datastore  (versioned triples — THE MOAT)      │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Tech stack (proposed)
- **Pre-flight engine + CLI:** TypeScript (Node), distributed as an npm package and a
  composite GitHub Action. Rules engine is pure functions, fully unit-tested. No LLM.
- **Binary/plist inspection:** Swift/`plutil`-free parsing where possible; otherwise a
  small Swift helper invoked only when a `.ipa`/`.app` is present. Privacy-manifest and
  Info.plist are XML/JSON — parse directly.
- **Backend (paid agent):** TypeScript service (Hono/Fastify) + Postgres (Neon).
  Stores submissions, rejections, fix_deltas, triples.
- **ASC integration (Leg A):** App Store Connect API via JWT (ES256) least-privilege
  key the user grants. Poller is a scheduled worker (30–60 min cadence).
- **Leg B ingestion:** dedicated email address (inbound webhook, e.g. a mail provider)
  + OCR fallback for pasted screenshots.
- **LLM:** Claude (claude-opus-4-8 for drafting/diagnosis, a cheaper model for
  classification) with retrieval over the corpus + current Review Guidelines.
- **Corpus store:** Postgres + pgvector for RAG; triples versioned against
  `guidelines_revision_id`.

## 3. Phased build

### Phase 1 — The free wedge (deterministic pre-flight + Action)  ← ship first
Goal: `<10 min` install, immediate value, zero account migration. Day-0 value with no
corpus.
- Rules engine modules: privacy-manifest completeness, required-reason-API detection,
  PII/usage-description gaps, bundle id / asset sizing / cert-profile validity,
  metadata lint (broken URLs, competitor mentions, placeholder text).
- GitHub Action wrapper: reads commit/diff + build artifact if present, runs audit,
  posts a PR check with each finding + the exact fix.
- CLI parity (`aerodeploy preflight`) for non-GitHub CI (Bitrise, Codemagic, EAS).
- Telemetry opt-in: seeds `SUBMISSION_STATE` into the corpus intake at scale.
- **Exit criteria:** high-precision (low false-positive) findings on a corpus of real
  open-source iOS apps; published catch list; OSS repo live.

### Phase 2 — Outcome state (Leg A) + data model
- Minimal data model (PRD §13.3): `submission`, `rejection`, `fix_delta`, `triple`.
- ASC key onboarding (least-privilege scopes: metadata, build status, submission state).
- Polling worker: track version/reviewSubmission state transitions; on
  `REJECTED | METADATA_REJECTED` → fire diagnosis event.
- **Exit criteria:** we can observe REJECTED→APPROVED transitions for a design partner
  end-to-end, persisted.

### Phase 3 — Rejection diagnosis + appeal drafting (Leg B + LLM)
- Email ingestion endpoint (user forwards Apple rejection email) + OCR fallback.
- Parse `guideline_codes`, `reviewer_text` → `parsed_cause` + confidence.
- LLM diagnosis (RAG over guidelines; corpus when populated) → plain-language reason +
  drafted evidence-backed appeal (code refs, policy citations, screenshots, precedents).
- **Exit criteria:** a real rejection produces a usable drafted appeal a non-technical
  founder can submit.

### Phase 4 — Fix attribution (Leg C) + verified triple
- Diff rejected build N vs approved N+1: code, entitlements/Info.plist, manifest,
  metadata/screenshots.
- Constrain attribution by Leg B cause; deterministic causes → near-certain,
  judgment causes → probabilistic with stored `fix_confidence`.
- Write VERIFIED triple (outcome read from ASC, never user-asserted), versioned against
  guideline revision.
- **Exit criteria:** first verified triples written; verified-triple-per-guideline-code
  metric live.

### Phase 5 — Prediction + flywheel
- Pre-submission rejection prediction: risk score + cited reasons, RAG over corpus.
- **Confidence suppression**: below verified-triple threshold per guideline code,
  present "deterministic check passed" only — never imply corpus confidence we lack.
- Benchmarks: pre-submission catch rate, rejection-rate reduction, appeal uplift,
  time-to-approval, OSS→paid activation.

### Phase 6 — Productize & expand
- Paid agent packaging, billing (price on outcomes, not seats), onboarding.
- Agency/portfolio dashboard (fastest verified-corpus source).
- TestFlight/submission one-click push (table-stakes onboarding hook).
- Content engine: anonymized rejection post-mortems (SEO/social proof).
- Fast-follow: Google Play.

## 4. Explicit non-goals (PRD §8)
Build infra / Mac runners · general CI/CD replacement · backend deploy orchestration ·
Android at launch · **scraping Apple's iris backend** (ToS — capture reason via
user-mediated channel only).

## 5. Top risks carried into the build
- **Cold-start on corpus** — ship deterministic value day 0; recruit 10–20 high-volume
  design partners (agencies) wired into Leg A+B early.
- **Leg B friction vs ToS** — we choose friction (email/OCR) on principle.
- **Polling, not push** — no review webhook exists; loop is poll-driven.
- **Prediction trust** — augmentation framing + published hit-rate + appeal backstop;
  never market certainty.
- **Triples decay** with guideline revisions — corpus is versioned, not append-only.

## 6. Open questions for review
1. Build order: is the free Action truly the first thing to ship, or do we need ≥1
   design partner wired into Leg A+B in parallel to de-risk cold-start?
2. Where does the deterministic engine's logic live so OSS users get it free but the
   corpus-backed prediction stays paid?
3. Team/sequencing: what is the smallest team that can ship Phase 1 + start Phase 2–4?
4. What is the single Phase-1 success metric that proves the wedge before we invest in
   the corpus machinery?

## 7. CEO review outcomes (HOLD SCOPE, 2026-06-18)

### Decisions made
- **Build order: A — dual-track from day 0.** Build the free Action solo for distribution,
  but wire 2-3 design-partner agencies into Leg A + Leg B in parallel so the corpus starts
  compounding immediately. Rationale: the free pre-flight is now a commoditized AI-skill
  category (App Store Reject + multiple free Claude/Cursor skills); the ASC outcome-verified
  loop is the only defensible asset, so it cannot be deferred.
- **F2 ACCEPTED: appeal-hallucination eval is a ship gate.** Before the appeal feature ships:
  (1) deterministic check that every cited guideline code resolves against the current
  guidelines list — block/flag drafts citing anything unresolvable; (2) LLM-judge eval that
  flags claims not grounded in the rejection text/corpus. Runs on a fixture set AND as a
  runtime pre-send guard.
- **F1 ACCEPTED: bind Leg B to ASC-confirmed rejection.** Only accept a rejection reason if
  Leg A independently shows that exact submission, in that account, transitioned to REJECTED in
  the matching window. Cross-check sender domain (apple.com) + app_id + timestamp. No match =
  quarantine, excluded from the shared corpus + RAG (per-customer reason still usable for their
  own appeal). Closes the corpus-poisoning vector structurally and makes "outcome-verified" true
  end-to-end. Effort: human ~3 days / CC ~30 min.

### Open strategic questions (from outside-voice pass — for /plan-eng-review + partner validation)
1. Which rejection types do design partners actually hit? Corpus may compound fastest on
   deterministic causes that are least defensible.
2. ASC API-key onboarding friction for non-technical founders — the moat needs the hardest
   onboarding from the least technical user.
3. Dual-track = two sales motions (founders vs agencies). Competes for build time.
4. Free→ASC-connected conversion rate is the real cold-start funnel; currently unmodeled.

### Error & Rescue Registry (planned codepaths)
```
CODEPATH                  | FAILURE MODE                  | RESCUE ACTION              | USER SEES
--------------------------|-------------------------------|----------------------------|------------------
ASC poller (Leg A)        | API timeout / 5xx             | backoff + retry, alert     | nothing (transparent)
ASC poller                | 401 (key revoked/expired)     | mark account, notify user  | "reconnect App Store Connect"
ASC poller                | unknown new state string      | log + alert, skip triple   | nothing; ops alerted
Leg B ingest              | non-Apple sender / spoof      | quarantine, don't trust    | "couldn't verify this email"
Leg B OCR                 | garbled / empty OCR           | ask for re-paste/forward   | "couldn't read screenshot"
Leg B match               | no matching ASC submission    | quarantine (F1 risk)       | "we'll process once Apple updates"
LLM diagnosis             | refusal / malformed JSON      | retry once, then manual    | "diagnosis unavailable, retry"
LLM appeal draft          | hallucinated guideline code   | BLOCK (F2 gate)            | "draft held — citation check failed"
Fix attribution (Leg C)   | N+1 changed many files        | store low fix_confidence   | nothing; triple marked noisy
```

### Failure Modes Registry
```
CODEPATH         | FAILURE MODE            | RESCUED? | TEST? | USER SEES?  | LOGGED?
-----------------|-------------------------|----------|-------|-------------|--------
ASC poller       | silent state-machine    | Y(alert) | needs | ops alert   | Y
                 |   drift / loop stalls    |          |       |             |
Leg B ingest     | poisoned reason         | Y (F1)   | needs | quarantine  | Y        ← closed: ASC-bound only
LLM appeal       | hallucinated citation   | Y (F2)   | Y     | "held"      | Y
Fix attribution  | wrong fix attributed    | partial  | needs | Silent      | Y(conf.) ← noisy-but-labeled by design
```

### NOT in scope (v1, deferred with rationale)
- Google Play — fast-follow, not v1.
- Agency portfolio dashboard — expansion phase.
- Scraping Apple's iris backend — refused on ToS principle (PRD §13.2).

### TODOs (carry into implementation)
- **[P1] Leg B → ASC trust binding (F1, in scope)** — bind each reason to ASC-confirmed
  REJECTED (account+app+timestamp); quarantine unmatched; never merge unbound data into the
  shared corpus. Foundation of the "outcome-verified" claim.
- **[P1] Appeal citation-resolves + judge eval** (F2) — ship gate for appeal feature.
- **[P1] `verified_triples_per_guideline_code` dashboard + weekly-triples heartbeat alert** —
  moat metric AND confidence-suppression gate AND poller-stall detector.
- **[P2] ASC key onboarding flow** — least-privilege scoping UI + revocation path; measure
  free→ASC conversion.
- **[P2] Deterministic engine eval corpus** — real rejected/approved apps, false-positive budget.
- **[P3] Validate rejection-type mix with design partners** before over-investing corpus on
  low-defensibility deterministic causes.

## 8. Eng review outcomes (2026-06-18)

### Architecture decisions
- **E1 ACCEPTED: OSS engine package + private backend.** Deterministic rules engine ships as a
  standalone MIT package (`@aerodeploy/preflight-engine`); the free GitHub Action is a thin OSS
  wrapper over it; corpus / prediction / RAG / ASC poller / Leg B live in a separate **private**
  repo depending on the same package. One engine, one test suite, moat stays private. Set at
  commit #1.
- **E2 ACCEPTED: managed inbound-email + OCR fallback.** Use a managed inbound-parse provider
  (Postmark/SendGrid/Mailgun) → webhook with DKIM/SPF verdicts. Verify apple.com DKIM, then bind
  to the ASC submission per F1. Screenshot OCR is the fallback. No self-hosted mail server.

### Engineering guidance (folded into tasks, not blocking)
- Poller = durable scheduler + queue (not in-process cron); jittered scheduling + per-ASC-key
  rate-limit budget + backoff.
- Deterministic engine = pure functions, no I/O/LLM; ASC/LLM/email as injected adapters for mocking.
- Cache current-guidelines list (used by every diagnosis AND the F2 citation check).
- **Leg C confidence threshold:** exclude low-confidence fix attributions from RAG so the
  highest-value-but-least-confident triples don't pollute future appeals (ties to RAG feedback loop).

### Test requirements (write alongside code — 0/14 paths covered, greenfield)
- Engine: unit tests + real-app fixture corpus, false-positive budget.
- Leg A poller: timeout / 401 / unknown-state branches.
- Leg B: DKIM spoof, F1 match/no-match→quarantine/wrong-app, OCR garbled/empty.
- **Evals (gates):** draftAppeal (F2 citation-resolves + grounding judge), parseRejection accuracy.
- E2E: full REJECTED→APPROVED loop writes one verified triple; OSS Action posts PR check.

### Worktree parallelization
| Lane | Workstream | Modules | Depends on |
|------|-----------|---------|-----------|
| A | OSS engine + Action | `preflight-engine/`, `action/` | — |
| B | ASC poller + data model | `backend/poller/`, `backend/db/` | — |
| C | Leg B ingest | `backend/ingest/` | B (data model) |
| D | LLM diagnosis/appeal + evals | `backend/llm/` | B (data model) |
| E | Leg C attribution + triple writer | `backend/attribution/` | B, C, D |
Launch A + B in parallel. After B: C and D in parallel. Then E. A is fully independent
(different repo) and can ship first as the wedge.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | clean | HOLD_SCOPE; 2 critical findings resolved (F1 bind Leg B→ASC, F2 appeal eval gate); build order = dual-track |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 2 arch decisions (E1 OSS engine/private backend, E2 managed inbound-email); 14 test paths specified; 0 critical gaps |

- **VERDICT:** CEO + ENG CLEARED — ready to implement. Build order = dual-track; engine is OSS, moat is private; Leg B bound to ASC (F1); appeals eval-gated (F2); Leg B email via managed provider (E2).

NO UNRESOLVED DECISIONS
