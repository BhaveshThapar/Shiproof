import SwiftUI
import CoreLocation

// A realistic SwiftUI weather app. It uses CoreLocation (declared with a purpose
// string in Info.plist) and UserDefaults (declared in the privacy manifest with
// an approved reason), so a precise engine must report ZERO findings here.
final class LocationProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private let store = UserDefaults.standard

    func start() {
        manager.delegate = self
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    func rememberLastCity(_ name: String) {
        store.set(name, forKey: "lastCity")
    }
}

struct WeatherView: View {
    @StateObject private var location = LocationProvider()

    var body: some View {
        Text("Weather")
            .onAppear { location.start() }
    }
}
