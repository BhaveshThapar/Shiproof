import Foundation
import AppTrackingTransparency

// Dirty fixture: requests tracking authorization with no NSUserTrackingUsageDescription
// in Info.plist (purpose-string), and uses UserDefaults with no privacy manifest
// (required-reason-api). Both are deterministic rejections.
final class Analytics {
    private let defaults = UserDefaults.standard

    func enable() {
        ATTrackingManager.requestTrackingAuthorization { _ in }
        defaults.set(true, forKey: "analyticsEnabled")
    }
}
