import Foundation

// A realistic UIKit to-do app. It persists items in UserDefaults, declared in
// the privacy manifest with an approved reason, and uses no sensitive APIs.
// A precise engine must report ZERO findings here.
final class TodoStore {
    private let defaults = UserDefaults.standard
    private let key = "items.v2"

    func load() -> [String] {
        defaults.stringArray(forKey: key) ?? []
    }

    func save(_ items: [String]) {
        defaults.set(items, forKey: key)
    }
}
