import Foundation
import CoreLocation

// Dirty sample app: uses UserDefaults with no privacy manifest, and uses
// CoreLocation with no NSLocationWhenInUseUsageDescription.
final class Feed {
    let defaults = UserDefaults.standard
    let locationManager = CLLocationManager()

    func start() {
        locationManager.requestWhenInUseAuthorization()
        defaults.set(true, forKey: "started")
    }
}
