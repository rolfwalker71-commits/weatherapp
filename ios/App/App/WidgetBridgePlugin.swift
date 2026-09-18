import Capacitor
import Foundation
import WidgetKit

/// Hands the app's location to the widget extension through the shared App Group.
/// JS side: src/lib/widget-bridge.ts. Keys must match WeatherWidget/WeatherCore.swift.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setPlace", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWindUnit", returnType: CAPPluginReturnPromise)
    ]

    private static let appGroup = "group.ch.rolfwalker.wetter"
    private static let placeKey = "widget.place"
    private static let windUnitKey = "widget.windUnit"

    @objc func setPlace(_ call: CAPPluginCall) {
        guard
            let name = call.getString("name"),
            let latitude = call.getDouble("latitude"),
            let longitude = call.getDouble("longitude")
        else {
            call.reject("name, latitude und longitude sind erforderlich")
            return
        }
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("App Group nicht verfügbar")
            return
        }
        let payload: [String: Any] = [
            "name": name,
            "latitude": latitude,
            "longitude": longitude,
            "isCurrentLocation": call.getBool("isCurrentLocation") ?? false
        ]
        let previous = defaults.data(forKey: Self.placeKey)
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? NSDictionary }
        // Only reload timelines when the place actually changed; reloads are budgeted by iOS.
        if previous != (payload as NSDictionary),
           let data = try? JSONSerialization.data(withJSONObject: payload) {
            defaults.set(data, forKey: Self.placeKey)
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    @objc func setWindUnit(_ call: CAPPluginCall) {
        guard let unit = call.getString("unit"), unit == "kmh" || unit == "ms" else {
            call.reject("unit muss kmh oder ms sein")
            return
        }
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("App Group nicht verfügbar")
            return
        }
        if defaults.string(forKey: Self.windUnitKey) != unit {
            defaults.set(unit, forKey: Self.windUnitKey)
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
