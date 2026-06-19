import type { Finding, InfoPlist, ProjectSnapshot } from "../types.js";
import { GUIDELINES } from "../guidelines.js";
import { lineOf } from "./util.js";
import { maskComments } from "./source.js";

/**
 * Sensitive-API usage that requires a purpose string in Info.plist. Using the
 * API without the matching usage-description key crashes the app on first use
 * and is a reliable rejection (5.1.1). Deterministic, so we catch it pre-flight.
 */
type PurposeStringRule = {
  /** The Info.plist key that must be present and non-empty. */
  key: string;
  label: string;
  patterns: RegExp[];
};

export const PURPOSE_STRING_RULES: PurposeStringRule[] = [
  {
    key: "NSCameraUsageDescription",
    label: "Camera",
    patterns: [/\bAVCaptureDevice\b/, /\bAVCaptureSession\b/, /\.camera\b/],
  },
  {
    key: "NSMicrophoneUsageDescription",
    label: "Microphone",
    patterns: [/\bAVAudioRecorder\b/, /\brequestRecordPermission\b/, /\.audio\b.*AVCapture/],
  },
  {
    key: "NSPhotoLibraryUsageDescription",
    label: "Photo library",
    patterns: [/\bPHPhotoLibrary\b/, /\bPHAsset\b/, /\.photoLibrary\b/],
  },
  {
    key: "NSLocationWhenInUseUsageDescription",
    label: "Location",
    patterns: [/\bCLLocationManager\b/, /\brequestWhenInUseAuthorization\b/],
  },
  {
    key: "NSContactsUsageDescription",
    label: "Contacts",
    patterns: [/\bCNContactStore\b/],
  },
  {
    key: "NSCalendarsUsageDescription",
    label: "Calendar",
    patterns: [/\bEKEventStore\b/],
  },
  {
    key: "NSBluetoothAlwaysUsageDescription",
    label: "Bluetooth",
    patterns: [/\bCBCentralManager\b/, /\bCBPeripheralManager\b/],
  },
  {
    key: "NSFaceIDUsageDescription",
    label: "Face ID",
    patterns: [/\bLAContext\b/, /\bdeviceOwnerAuthenticationWithBiometrics\b/],
  },
  {
    key: "NSUserTrackingUsageDescription",
    label: "App tracking transparency",
    patterns: [/\bATTrackingManager\b/, /\brequestTrackingAuthorization\b/],
  },
  {
    key: "NSMotionUsageDescription",
    label: "Motion & fitness",
    patterns: [/\bCMMotionManager\b/, /\bCMPedometer\b/],
  },
];

function isAppSource(path: string): boolean {
  return /\.(swift|m|mm|h)$/i.test(path);
}

function hasNonEmptyKey(plists: InfoPlist[], key: string): boolean {
  return plists.some((plist) => {
    const value = plist.values[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function scanPurposeStrings(snapshot: ProjectSnapshot): Finding[] {
  const findings: Finding[] = [];

  // Mask comments once per file (API names mentioned in comments are not usage).
  const sources = snapshot.sourceFiles
    .filter((file) => isAppSource(file.path))
    .map((file) => ({ path: file.path, content: maskComments(file.content) }));

  for (const rule of PURPOSE_STRING_RULES) {
    let hit: { file: string; line: number } | undefined;
    for (const file of sources) {
      for (const pattern of rule.patterns) {
        const match = pattern.exec(file.content);
        if (match) {
          hit = { file: file.path, line: lineOf(file.content, match.index) };
          break;
        }
      }
      if (hit) break;
    }
    if (!hit) continue;

    if (!hasNonEmptyKey(snapshot.infoPlists, rule.key)) {
      findings.push({
        checkId: "purpose-string",
        severity: "error",
        title: `Missing ${rule.label} usage description`,
        detail: `Your code uses the ${rule.label} API but Info.plist has no non-empty ${rule.key}. iOS terminates the app the moment it requests this permission, and App Review flags it.`,
        fix: `Add a ${rule.key} entry to Info.plist describing, in plain language, why your app needs ${rule.label.toLowerCase()} access.`,
        guideline: GUIDELINES.dataCollection,
        location: hit,
      });
    }
  }

  return findings;
}
