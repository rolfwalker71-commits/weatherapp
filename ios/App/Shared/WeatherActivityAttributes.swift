import ActivityKit
import Foundation

/// Live Activity model shared by the app (starts and updates it) and the widget extension (draws it).
/// Field names must stay in sync with src/lib/live-activities.ts and, later, the APNs payloads.
@available(iOS 16.1, *)
struct WeatherActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// "Regen in 12 Min." / "Gewitterwarnung"
        var headline: String
        /// "leicht · etwa 1 mm" / "Stufe 3 · MeteoSchweiz"
        var detail: String
        /// SF Symbol for compact and minimal presentations.
        var symbol: String
        /// Rain: when it starts (live countdown); nil while it is already raining.
        var startsAt: Date?
        /// Rain: when it stops; warning: when it expires.
        var endsAt: Date?
        /// Rain: mm per 15 minutes for the next 2 hours (8 values), for the bar chart.
        var series: [Double]
        /// Warning level 1–4 (yellow → red); 0 for rain.
        var level: Int
    }

    /// "rain" or "warning" — at most one activity of each kind runs at a time.
    var kind: String
    var place: String
}
