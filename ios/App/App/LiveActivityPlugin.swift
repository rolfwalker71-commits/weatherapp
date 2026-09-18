import ActivityKit
import Capacitor
import Foundation

/// Starts, updates and ends the weather Live Activities. JS side: src/lib/live-activities.ts.
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["available": false])
            return
        }
        call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
    }

    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        guard
            let kind = call.getString("kind"),
            let place = call.getString("place"),
            let raw = call.getObject("state")
        else {
            call.reject("kind, place und state sind erforderlich")
            return
        }
        let state = WeatherActivityAttributes.ContentState(
            headline: raw["headline"] as? String ?? "",
            detail: raw["detail"] as? String ?? "",
            symbol: raw["symbol"] as? String ?? "cloud.rain.fill",
            startsAt: Self.date(raw["startsAt"]),
            endsAt: Self.date(raw["endsAt"]),
            series: (raw["series"] as? [Any])?.compactMap { ($0 as? NSNumber)?.doubleValue } ?? [],
            level: (raw["level"] as? NSNumber)?.intValue ?? 0
        )
        Task {
            do {
                try await LiveActivities.show(kind: kind, place: place, state: state)
                call.resolve()
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *), let kind = call.getString("kind") else {
            call.resolve()
            return
        }
        Task {
            await LiveActivities.end(kind: kind)
            call.resolve()
        }
    }

    /// JS sends epoch milliseconds.
    private static func date(_ value: Any?) -> Date? {
        (value as? NSNumber).map { Date(timeIntervalSince1970: $0.doubleValue / 1000) }
    }
}

@available(iOS 16.2, *)
enum LiveActivities {
    static func show(kind: String, place: String, state: WeatherActivityAttributes.ContentState) async throws {
        // Without fresh data from the app (or, later, the server) iOS greys the activity out.
        let content = ActivityContent(
            state: state,
            staleDate: Date().addingTimeInterval(30 * 60),
            relevanceScore: kind == "warning" ? 100 : 50
        )
        let running = Activity<WeatherActivityAttributes>.activities.filter { $0.attributes.kind == kind }
        if let current = running.first(where: { $0.attributes.place == place }) {
            await current.update(content)
            return
        }
        // Moved to another place: replace instead of showing two.
        for activity in running {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        _ = try Activity.request(
            attributes: WeatherActivityAttributes(kind: kind, place: place),
            content: content,
            pushType: nil
        )
    }

    static func end(kind: String) async {
        for activity in Activity<WeatherActivityAttributes>.activities where activity.attributes.kind == kind {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    #if DEBUG
    /// `xcrun simctl launch booted ch.rolfwalker.wetter -LiveActivityDemo` shows both kinds with sample data.
    static func showDemo() async {
        let now = Date()
        try? await show(kind: "rain", place: "Zürich", state: .init(
            headline: "Regen ab \(now.addingTimeInterval(12 * 60).formatted(date: .omitted, time: .shortened))",
            detail: "mässig · etwa 3 mm in der nächsten Stunde",
            symbol: "cloud.rain.fill",
            startsAt: now.addingTimeInterval(12 * 60),
            endsAt: now.addingTimeInterval(75 * 60),
            series: [0, 0.1, 0.6, 1.2, 0.9, 0.4, 0.1, 0],
            level: 0
        ))
        try? await show(kind: "warning", place: "Zürich", state: .init(
            headline: "Gewitterwarnung",
            detail: "Stufe 3 · Hagel und Sturmböen möglich",
            symbol: "cloud.bolt.rain.fill",
            startsAt: nil,
            endsAt: now.addingTimeInterval(3 * 3600),
            series: [],
            level: 3
        ))
    }
    #endif
}
