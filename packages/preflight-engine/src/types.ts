/**
 * Public types for the AeroDeploy pre-flight engine.
 *
 * The engine is intentionally PURE: it takes an already-parsed snapshot of a
 * project and returns findings. All file-system / network I/O lives in the
 * adapters (the CLI and the GitHub Action), never here. That keeps every check
 * trivially unit-testable and keeps this package free of platform assumptions.
 */

export type Severity = "error" | "warning" | "info";

/** A reference to the Apple guideline / documentation behind a finding. */
export type GuidelineRef = {
  /** App Review Guideline section (e.g. "5.1.1") or a doc slug. */
  code: string;
  title: string;
  url: string;
};

export type FindingLocation = {
  file: string;
  /** 1-based line number, when the cause is a specific source line. */
  line?: number;
};

/** One deterministic, high-precision rejection-risk finding. */
export type Finding = {
  /** Stable id for the check that produced this (e.g. "required-reason-api"). */
  checkId: string;
  severity: Severity;
  title: string;
  /** What was detected, in plain language a non-technical founder can act on. */
  detail: string;
  /** The exact change to make. */
  fix: string;
  guideline: GuidelineRef;
  location?: FindingLocation;
};

export type SourceFile = {
  path: string;
  content: string;
};

/** A parsed PrivacyInfo.xcprivacy manifest. */
export type PrivacyManifest = {
  path: string;
  /** NSPrivacyAccessedAPITypes entries. */
  accessedApiTypes: PrivacyAccessedApiType[];
};

export type PrivacyAccessedApiType = {
  /** e.g. "NSPrivacyAccessedAPICategoryUserDefaults". */
  category: string;
  /** Declared reason codes, e.g. ["CA92.1"]. */
  reasons: string[];
};

/** A parsed Info.plist (only the keys we care about need be present). */
export type InfoPlist = {
  path: string;
  values: Record<string, string | boolean | undefined>;
};

/** App Store Connect listing metadata (from an export or a local config file). */
export type AppMetadata = {
  name?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  privacyPolicyUrl?: string;
  supportUrl?: string;
  marketingUrl?: string;
  releaseNotes?: string;
};

/** Everything the engine needs to evaluate a release, fully parsed. */
export type ProjectSnapshot = {
  sourceFiles: SourceFile[];
  privacyManifests: PrivacyManifest[];
  infoPlists: InfoPlist[];
  metadata?: AppMetadata;
};

export type PreflightSummary = {
  error: number;
  warning: number;
  info: number;
};

export type PreflightResult = {
  findings: Finding[];
  summary: PreflightSummary;
};

export type PreflightOptions = {
  /**
   * Lowest severity to include. Defaults to "info" (everything).
   * "error" returns only blocking findings.
   */
  minSeverity?: Severity;
};
