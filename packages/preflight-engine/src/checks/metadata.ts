import type { AppMetadata, Finding } from "../types.js";
import { GUIDELINES } from "../guidelines.js";

/**
 * Metadata lint: the shallow-but-frequent rejection causes Apple catches in the
 * listing rather than the binary. Operates on parsed App Store Connect metadata
 * (from an export or a local config file).
 */

// Only unambiguous leftover markers — bare "placeholder" is intentionally NOT
// here: real listings legitimately describe "placeholder text" UI, so matching it
// is a false positive (the wedge's enemy). See eval-corpus/clean-uikit-todo.
const PLACEHOLDER_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /lorem ipsum/i, what: '"lorem ipsum" placeholder text' },
  { re: /\bTODO\b/, what: "a TODO marker" },
  { re: /\bFIXME\b/, what: "a FIXME marker" },
  { re: /your app name/i, what: 'the literal "your app name" placeholder' },
  { re: /\blocalhost\b/i, what: "a localhost reference" },
];

const OTHER_PLATFORM_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /\bandroid\b/i, what: "Android" },
  { re: /google play/i, what: "Google Play" },
  { re: /\bplay store\b/i, what: "the Play Store" },
];

const URL_FIELDS: { field: keyof AppMetadata; label: string }[] = [
  { field: "supportUrl", label: "Support URL" },
  { field: "marketingUrl", label: "Marketing URL" },
  { field: "privacyPolicyUrl", label: "Privacy Policy URL" },
];

function isValidHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

export function lintMetadata(metadata: AppMetadata | undefined): Finding[] {
  if (!metadata) return [];
  const findings: Finding[] = [];

  const textFields: { value: string | undefined; label: string }[] = [
    { value: metadata.description, label: "description" },
    { value: metadata.releaseNotes, label: "release notes" },
    { value: metadata.subtitle, label: "subtitle" },
    { value: metadata.keywords, label: "keywords" },
  ];

  for (const { value, label } of textFields) {
    if (!value) continue;
    for (const { re, what } of PLACEHOLDER_PATTERNS) {
      if (re.test(value)) {
        findings.push({
          checkId: "metadata-placeholder",
          severity: "error",
          title: `Placeholder text in ${label}`,
          detail: `The ${label} contains ${what}. Apple rejects listings with placeholder or unfinished metadata.`,
          fix: `Replace the placeholder content in your ${label} with the real, final copy before submitting.`,
          guideline: GUIDELINES.accurateMetadata,
        });
        break;
      }
    }
  }

  if (metadata.description) {
    for (const { re, what } of OTHER_PLATFORM_PATTERNS) {
      if (re.test(metadata.description)) {
        findings.push({
          checkId: "metadata-other-platform",
          severity: "warning",
          title: `Description mentions ${what}`,
          detail: `Your description references ${what}. References to other platforms or stores are a common metadata rejection.`,
          fix: `Remove the mention of ${what} from your App Store description.`,
          guideline: GUIDELINES.otherBusinessModel,
        });
        break;
      }
    }
  }

  if (!metadata.privacyPolicyUrl || metadata.privacyPolicyUrl.trim().length === 0) {
    findings.push({
      checkId: "metadata-privacy-policy",
      severity: "error",
      title: "Missing privacy policy URL",
      detail:
        "No privacy policy URL is set. Apple requires every app to have a privacy policy link.",
      fix: "Add a reachable https privacy policy URL in App Store Connect (App Privacy section).",
      guideline: GUIDELINES.dataCollection,
    });
  }

  for (const { field, label } of URL_FIELDS) {
    const value = metadata[field];
    if (typeof value === "string" && value.trim().length > 0 && !isValidHttpUrl(value)) {
      findings.push({
        checkId: "metadata-invalid-url",
        severity: "error",
        title: `${label} is not a valid URL`,
        detail: `The ${label} ("${value}") is not a valid http/https URL. Broken URLs in metadata are a frequent rejection cause.`,
        fix: `Correct the ${label} so it is a fully-qualified https URL that loads.`,
        guideline: GUIDELINES.accurateMetadata,
      });
    }
  }

  return findings;
}
