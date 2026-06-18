import Foundation

// A clean sample app: uses UserDefaults but declares it in the privacy manifest,
// and uses no sensitive APIs without a purpose string.
final class History {
    private let store = UserDefaults.standard

    func remember(_ result: Double) {
        store.set(result, forKey: "lastResult")
    }
}
