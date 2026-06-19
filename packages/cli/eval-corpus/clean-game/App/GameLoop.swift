import Foundation

// A realistic SpriteKit-style game loop. It reads mach_absolute_time for frame
// pacing (the System Boot Time required-reason category), declared in the privacy
// manifest with an approved reason. No sensitive APIs, no UserDefaults.
// A precise engine must report ZERO findings here.
final class FrameClock {
    private var last: UInt64 = mach_absolute_time()

    func tick() -> Double {
        let now = mach_absolute_time()
        let delta = now &- last
        last = now
        return Double(delta) / 1_000_000_000.0
    }
}
