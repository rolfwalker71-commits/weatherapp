import Foundation
import SwiftUI

/// Values the app writes into the shared App Group (see `WidgetBridgePlugin` in the app target).
enum SharedStore {
    static let appGroup = "group.ch.rolfwalker.wetter"
    static let placeKey = "widget.place"
    static let windUnitKey = "widget.windUnit"
    static let cacheKey = "widget.forecast"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? .standard
    }
}

struct WidgetPlace: Codable, Equatable {
    var name: String
    var latitude: Double
    var longitude: Double
    var isCurrentLocation: Bool?

    /// Same fallback as the app (`BERN` in src/lib/api.ts).
    static let bern = WidgetPlace(name: "Bern", latitude: 46.948, longitude: 7.4474, isCurrentLocation: false)

    static func load() -> WidgetPlace {
        guard
            let data = SharedStore.defaults.data(forKey: SharedStore.placeKey),
            let place = try? JSONDecoder().decode(WidgetPlace.self, from: data)
        else { return .bern }
        return place
    }
}

struct HourPoint: Hashable {
    let date: Date
    let temperature: Double
    let code: Int
    let isDay: Bool
    let precipProb: Int?
    var precipMm: Double = 0
    /// km/h, like the app's Open-Meteo data; converted for display in `Format.wind`.
    var wind: Double = 0
    var gusts: Double?
    var windDirection: Double?
}

struct DayPoint: Hashable {
    let date: Date
    let code: Int
    let tMin: Double
    let tMax: Double
    let precipProb: Int?
}

struct Forecast {
    let place: WidgetPlace
    let timeZone: TimeZone
    let current: HourPoint
    let hours: [HourPoint]
    let days: [DayPoint]
}

// MARK: - Open-Meteo

private struct OMResponse: Decodable {
    struct Current: Decodable {
        let time: Int
        let temperature_2m: Double
        let weather_code: Int
        let is_day: Int
        let precipitation: Double?
        let wind_speed_10m: Double?
        let wind_gusts_10m: Double?
        let wind_direction_10m: Double?
    }

    struct Hourly: Decodable {
        let time: [Int]
        let temperature_2m: [Double?]
        let weather_code: [Int?]
        let is_day: [Int?]
        let precipitation_probability: [Int?]?
        let precipitation: [Double?]?
        let wind_speed_10m: [Double?]?
        let wind_gusts_10m: [Double?]?
        let wind_direction_10m: [Double?]?
    }

    struct Daily: Decodable {
        let time: [Int]
        let weather_code: [Int?]
        let temperature_2m_max: [Double?]
        let temperature_2m_min: [Double?]
        let precipitation_probability_max: [Int?]?
    }

    let utc_offset_seconds: Int
    let current: Current
    let hourly: Hourly
    let daily: Daily
}

enum WeatherService {
    static func url(for place: WidgetPlace) -> URL {
        var components = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        components.queryItems = [
            .init(name: "latitude", value: String(place.latitude)),
            .init(name: "longitude", value: String(place.longitude)),
            .init(name: "current", value: "temperature_2m,weather_code,is_day,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m"),
            .init(name: "hourly", value: "temperature_2m,weather_code,is_day,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m"),
            .init(name: "daily", value: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"),
            .init(name: "timezone", value: "auto"),
            .init(name: "timeformat", value: "unixtime"),
            .init(name: "forecast_days", value: "7")
        ]
        return components.url!
    }

    /// Fetches the forecast; on failure falls back to the last good response for the same place.
    static func load(for place: WidgetPlace) async -> Forecast? {
        let cacheKey = "\(SharedStore.cacheKey).\(place.latitude),\(place.longitude)"
        do {
            let (data, response) = try await URLSession.shared.data(from: url(for: place))
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let forecast = try decode(data, place: place)
            SharedStore.defaults.set(data, forKey: cacheKey)
            return forecast
        } catch {
            guard let cached = SharedStore.defaults.data(forKey: cacheKey) else { return nil }
            return try? decode(cached, place: place)
        }
    }

    static func decode(_ data: Data, place: WidgetPlace) throws -> Forecast {
        let raw = try JSONDecoder().decode(OMResponse.self, from: data)
        let zone = TimeZone(secondsFromGMT: raw.utc_offset_seconds) ?? .current

        var hours: [HourPoint] = []
        for (index, time) in raw.hourly.time.enumerated() {
            guard let temp = raw.hourly.temperature_2m[safe: index] ?? nil,
                  let code = raw.hourly.weather_code[safe: index] ?? nil else { continue }
            hours.append(HourPoint(
                date: Date(timeIntervalSince1970: TimeInterval(time)),
                temperature: temp,
                code: code,
                isDay: (raw.hourly.is_day[safe: index] ?? 1) == 1,
                precipProb: raw.hourly.precipitation_probability?[safe: index] ?? nil,
                precipMm: (raw.hourly.precipitation?[safe: index] ?? nil) ?? 0,
                wind: (raw.hourly.wind_speed_10m?[safe: index] ?? nil) ?? 0,
                gusts: raw.hourly.wind_gusts_10m?[safe: index] ?? nil,
                windDirection: raw.hourly.wind_direction_10m?[safe: index] ?? nil
            ))
        }

        var days: [DayPoint] = []
        for (index, time) in raw.daily.time.enumerated() {
            guard let code = raw.daily.weather_code[safe: index] ?? nil,
                  let tMax = raw.daily.temperature_2m_max[safe: index] ?? nil,
                  let tMin = raw.daily.temperature_2m_min[safe: index] ?? nil else { continue }
            days.append(DayPoint(
                date: Date(timeIntervalSince1970: TimeInterval(time)),
                code: code,
                tMin: tMin,
                tMax: tMax,
                precipProb: raw.daily.precipitation_probability_max?[safe: index] ?? nil
            ))
        }

        let currentDate = Date(timeIntervalSince1970: TimeInterval(raw.current.time))
        // Current has no probability; borrow it from the hour the observation falls in.
        let currentHour = hours.last { $0.date <= currentDate }
        let current = HourPoint(
            date: currentDate,
            temperature: raw.current.temperature_2m,
            code: raw.current.weather_code,
            isDay: raw.current.is_day == 1,
            precipProb: currentHour?.precipProb,
            precipMm: raw.current.precipitation ?? 0,
            wind: raw.current.wind_speed_10m ?? currentHour?.wind ?? 0,
            gusts: raw.current.wind_gusts_10m ?? currentHour?.gusts,
            windDirection: raw.current.wind_direction_10m ?? currentHour?.windDirection
        )
        return Forecast(place: place, timeZone: zone, current: current, hours: hours, days: days)
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - WMO codes (mirrors src/lib/wmo.ts)

enum WeatherMood {
    case clear, night, cloud, rain, snow, storm, fog

    /// Same sky gradients as the iOS hero in src/lib/styles/ios.css.
    var gradient: [Color] {
        switch self {
        case .clear: return [Color(hex: 0x2E7FD9), Color(hex: 0x57A4EC)]
        case .night: return [Color(hex: 0x0B1633), Color(hex: 0x26365F)]
        case .rain: return [Color(hex: 0x4A5A6C), Color(hex: 0x748598)]
        case .snow: return [Color(hex: 0x7890A8), Color(hex: 0xA9BCCD)]
        case .storm: return [Color(hex: 0x2B2F3A), Color(hex: 0x4B5264)]
        case .cloud: return [Color(hex: 0x5F7A96), Color(hex: 0x8EA4BA)]
        case .fog: return [Color(hex: 0x7D8893), Color(hex: 0xA7B0B8)]
        }
    }
}

enum WMO {
    static func mood(_ code: Int, isDay: Bool) -> WeatherMood {
        if !isDay && code <= 2 { return .night }
        if code <= 1 { return .clear }
        if code <= 3 { return .cloud }
        if code >= 95 { return .storm }
        if (71...77).contains(code) || code == 85 || code == 86 { return .snow }
        if (10...19).contains(code) || (40...49).contains(code) { return .fog }
        if code >= 51 { return .rain }
        return .cloud
    }

    static func label(_ code: Int) -> String {
        switch code {
        case 0: return "Klarer Himmel"
        case 1: return "Überwiegend klar"
        case 2: return "Teilweise bewölkt"
        case 3: return "Bedeckt"
        case 45: return "Nebel"
        case 48: return "Reifnebel"
        case 51: return "Leichter Nieselregen"
        case 53: return "Nieselregen"
        case 55: return "Starker Nieselregen"
        case 56: return "Leichter Eisniesel"
        case 57: return "Gefrierender Nieselregen"
        case 61: return "Leichter Regen"
        case 63: return "Regen"
        case 65: return "Starker Regen"
        case 66: return "Leichter Eisregen"
        case 67: return "Eisregen"
        case 71: return "Leichter Schneefall"
        case 73: return "Schneefall"
        case 75: return "Starker Schneefall"
        case 77: return "Schneegriesel"
        case 80: return "Leichte Regenschauer"
        case 81: return "Regenschauer"
        case 82: return "Heftige Regenschauer"
        case 85: return "Leichte Schneeschauer"
        case 86: return "Schneeschauer"
        case 95: return "Gewitter"
        case 96: return "Gewitter mit Hagel"
        case 99: return "Schweres Gewitter mit Hagel"
        case ...19: return "Dunst oder Nebel"
        case ...29: return "Niederschlag in der Nähe"
        case ...39: return "Schneeverwehung"
        case ...49: return "Nebel"
        case ...59: return "Nieselregen"
        case ...69: return "Regen"
        case ...79: return "Schnee"
        case ...84: return "Regenschauer"
        case ...94: return "Schneeschauer"
        default: return "Gewitter"
        }
    }

    /// SF Symbol; rendered multicolour on the home screen, monochrome on the lock screen.
    static func symbol(_ code: Int, isDay: Bool) -> String {
        switch code {
        case 0: return isDay ? "sun.max.fill" : "moon.stars.fill"
        case 1, 2: return isDay ? "cloud.sun.fill" : "cloud.moon.fill"
        case 3: return "cloud.fill"
        case 45, 48, 10...19, 40...49: return "cloud.fog.fill"
        case 51, 53, 55, 50...59: return "cloud.drizzle.fill"
        case 56, 57, 66, 67: return "cloud.sleet.fill"
        case 65, 82: return "cloud.heavyrain.fill"
        case 61, 63, 60...69: return "cloud.rain.fill"
        case 80, 81: return isDay ? "cloud.sun.rain.fill" : "cloud.moon.rain.fill"
        case 71...79, 85, 86: return "cloud.snow.fill"
        case 96, 99: return "cloud.hail.fill"
        case 95...: return "cloud.bolt.rain.fill"
        default: return "cloud.fill"
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

// MARK: - Formatting

enum WindUnit: String {
    case kmh, ms

    /// Set by the app (Einstellungen → Einheiten) through the App Group.
    static var current: WindUnit {
        SharedStore.defaults.string(forKey: SharedStore.windUnitKey).flatMap(WindUnit.init) ?? .kmh
    }
}

enum Format {
    static func wind(_ kmh: Double, unit: WindUnit = .current, withUnit: Bool = true) -> String {
        let value: String
        switch unit {
        case .kmh: value = "\(Int(kmh.rounded()))"
        case .ms: value = String(format: "%.1f", kmh / 3.6).replacingOccurrences(of: ".", with: ",")
        }
        guard withUnit else { return value }
        return unit == .ms ? "\(value) m/s" : "\(value) km/h"
    }

    /// 16-point compass, German abbreviations as in the app ("aus WNW").
    static func direction(_ degrees: Double?) -> String? {
        guard let degrees else { return nil }
        let names = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        let index = Int((degrees.truncatingRemainder(dividingBy: 360) / 22.5).rounded()) % 16
        return names[(index + 16) % 16]
    }

    static func percent(_ value: Int) -> String {
        "\(value) %"
    }

    static func temp(_ value: Double) -> String {
        "\(Int(value.rounded()))°"
    }

    static func hour(_ date: Date, zone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_CH")
        formatter.timeZone = zone
        formatter.dateFormat = "HH"
        return "\(formatter.string(from: date)) Uhr"
    }

    static func weekday(_ date: Date, zone: TimeZone) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        if calendar.isDate(date, inSameDayAs: Date()) { return "Heute" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_CH")
        formatter.timeZone = zone
        formatter.dateFormat = "EEEEEE"
        return formatter.string(from: date)
    }
}

// MARK: - Rain outlook

enum RainOutlook {
    /// An hour counts as wet from 0.1 mm or a 40 % chance, matching how the app phrases rain.
    static func isWet(_ hour: HourPoint) -> Bool {
        hour.precipMm >= 0.1 || (hour.precipProb ?? 0) >= 40
    }

    /// One short line for the next 12 hours, e.g. "Regen ab 22 Uhr" or "Trocken bis 08 Uhr".
    static func summary(now: HourPoint, upcoming: [HourPoint], zone: TimeZone) -> String {
        let window = Array(upcoming.prefix(12))
        if isWet(now) || now.precipMm > 0 {
            if let dry = window.first(where: { !isWet($0) }) {
                return "Regen bis \(Format.hour(dry.date, zone: zone))"
            }
            return "Regen hält an"
        }
        if let wet = window.first(where: isWet) {
            // The chance itself shows under that hour in the hourly row.
            return "Regen ab \(Format.hour(wet.date, zone: zone))"
        }
        if let last = window.last {
            return "Trocken bis \(Format.hour(last.date, zone: zone))"
        }
        return "Kein Regen erwartet"
    }
}
