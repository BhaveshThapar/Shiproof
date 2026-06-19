import SwiftUI

// Dirty fixture for the metadata lane only: the binary side is clean (no
// required-reason APIs, no sensitive-API usage, complete Info.plist) so the
// only findings come from the listing metadata.
struct ContentView: View {
    var body: some View {
        Text("Hello")
    }
}
