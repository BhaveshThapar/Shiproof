import type { GuidelineRef } from "./types.js";

/**
 * Stable references to the Apple guidelines / docs each check cites.
 * Kept in one place so the citations stay consistent and auditable — the same
 * discipline the paid product's appeal-drafting eval depends on (no invented
 * guideline codes).
 */
export const GUIDELINES = {
  requiredReasonApi: {
    code: "Privacy/RequiredReasonAPI",
    title: "Describing use of required reason API",
    url: "https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api",
  },
  privacyManifest: {
    code: "Privacy/PrivacyManifest",
    title: "Privacy manifest files",
    url: "https://developer.apple.com/documentation/bundleresources/privacy-manifest-files",
  },
  dataCollection: {
    code: "5.1.1",
    title: "Data Collection and Storage",
    url: "https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage",
  },
  accurateMetadata: {
    code: "2.3.1",
    title: "Accurate Metadata",
    url: "https://developer.apple.com/app-store/review/guidelines/#accurate-metadata",
  },
  otherBusinessModel: {
    code: "3.1.1",
    title: "In-App Purchase / platform references",
    url: "https://developer.apple.com/app-store/review/guidelines/#in-app-purchase",
  },
} as const satisfies Record<string, GuidelineRef>;
