export type {
  Severity,
  GuidelineRef,
  FindingLocation,
  Finding,
  SourceFile,
  PrivacyManifest,
  PrivacyAccessedApiType,
  InfoPlist,
  AppMetadata,
  ProjectSnapshot,
  PreflightSummary,
  PreflightResult,
  PreflightOptions,
} from "./types.js";

export { runPreflight, hasBlockingFindings } from "./engine.js";
export { GUIDELINES } from "./guidelines.js";
export { REQUIRED_REASON_CATEGORIES } from "./checks/requiredReasonApi.js";
export { PURPOSE_STRING_RULES } from "./checks/pii.js";
