import SwiftUI
import WidgetKit

// MARK: - Timeline

struct WeatherEntry: TimelineEntry {
    let date: Date
    let place: WidgetPlace
    let timeZone: TimeZone
    let now: HourPoint
    let hours: [HourPoint]
    let days: [DayPoint]
    /// No data at all (first run offline): the view shows a hint instead of numbers.
    let unavailable: Bool
    /// e.g. "Regen ab 22 Uhr" — covers the next 12 hours, not just the visible ones.
    var rainSummary: String = ""
    var windUnit: WindUnit = .kmh

    var today: DayPoint? { days.first }
    var mood: WeatherMood { WMO.mood(now.code, isDay: now.isDay) }
}

struct WeatherProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        .sample
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        if context.isPreview {
            completion(.sample)
            return
        }
        Task {
            let place = WidgetPlace.load()
            let forecast = await WeatherService.load(for: place)
            completion(forecast.flatMap { Self.entries(from: $0, start: Date()).first } ?? .sample)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        Task {
            let place = WidgetPlace.load()
            let now = Date()
            guard let forecast = await WeatherService.load(for: place) else {
                let entry = WeatherEntry.unavailable(place: place, date: now)
                completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(15 * 60))))
                return
            }
            let entries = Self.entries(from: forecast, start: now)
            // Hourly entries keep the widget current offline; refetch every 30 minutes.
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
        }
    }

    /// One entry now, then one per upcoming full hour, each shifting "now" to that hour's forecast.
    static func entries(from forecast: Forecast, start: Date) -> [WeatherEntry] {
        var result: [WeatherEntry] = []
        let upcoming = forecast.hours.filter { $0.date > start }.prefix(6)
        let starts = [start] + upcoming.map(\.date)

        for (offset, date) in starts.enumerated() {
            let nowPoint: HourPoint
            if offset == 0 {
                nowPoint = forecast.current
            } else {
                nowPoint = forecast.hours.first { $0.date == date } ?? forecast.current
            }
            let later = Array(forecast.hours.filter { $0.date > date }.prefix(5))
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = forecast.timeZone
            let days = forecast.days.filter {
                calendar.startOfDay(for: $0.date) >= calendar.startOfDay(for: date)
            }
            result.append(WeatherEntry(
                date: date,
                place: forecast.place,
                timeZone: forecast.timeZone,
                now: nowPoint,
                hours: [nowPoint] + later,
                days: days,
                unavailable: false,
                rainSummary: RainOutlook.summary(
                    now: nowPoint,
                    upcoming: forecast.hours.filter { $0.date > date },
                    zone: forecast.timeZone
                ),
                windUnit: WindUnit.current
            ))
        }
        return result
    }
}

extension WeatherEntry {
    static func unavailable(place: WidgetPlace, date: Date) -> WeatherEntry {
        WeatherEntry(
            date: date,
            place: place,
            timeZone: .current,
            now: HourPoint(date: date, temperature: 0, code: 3, isDay: true, precipProb: nil),
            hours: [],
            days: [],
            unavailable: true
        )
    }

    /// Gallery preview and placeholder.
    static var sample: WeatherEntry {
        let now = Date()
        let codes = [2, 2, 3, 3, 61, 61]
        let temps = [19.0, 18, 17, 17, 16, 15]
        let hours = (0..<6).map { index in
            HourPoint(
                date: now.addingTimeInterval(Double(index) * 3600),
                temperature: temps[index],
                code: codes[index],
                isDay: true,
                precipProb: index > 3 ? 60 : 0,
                precipMm: index > 3 ? 0.8 : 0,
                wind: 12 + Double(index) * 2,
                gusts: 25,
                windDirection: 290
            )
        }
        let dayCodes = [2, 3, 61, 0, 1]
        let days = (0..<5).map { index in
            DayPoint(
                date: now.addingTimeInterval(Double(index) * 86_400),
                code: dayCodes[index],
                tMin: 12 + Double(index % 3),
                tMax: 20 + Double(index % 4),
                precipProb: dayCodes[index] == 61 ? 70 : 0
            )
        }
        return WeatherEntry(
            date: now,
            place: WidgetPlace(name: "Zürich", latitude: 47.37, longitude: 8.54, isCurrentLocation: true),
            timeZone: .current,
            now: hours[0],
            hours: hours,
            days: days,
            unavailable: false,
            rainSummary: "Regen ab \(Format.hour(hours[4].date, zone: .current))"
        )
    }
}

// MARK: - Views

struct WeatherSymbol: View {
    let code: Int
    let isDay: Bool

    var body: some View {
        Image(systemName: WMO.symbol(code, isDay: isDay))
            .symbolRenderingMode(.multicolor)
    }
}

struct PlaceTitle: View {
    let entry: WeatherEntry

    var body: some View {
        HStack(spacing: 3) {
            Text(entry.place.name)
                .lineLimit(1)
            if entry.place.isCurrentLocation == true {
                Image(systemName: "location.fill")
                    .font(.system(size: 9, weight: .semibold))
            }
        }
        .font(.system(.subheadline, weight: .semibold))
    }
}

struct HighLow: View {
    let day: DayPoint?

    var body: some View {
        if let day {
            Text("H:\(Format.temp(day.tMax)) T:\(Format.temp(day.tMin))")
                .font(.system(.caption, weight: .semibold))
                .lineLimit(1)
        }
    }
}

/// Light blue that reads on every sky gradient; the Weather app uses the same for rain chances.
let rainTint = Color(hex: 0x8FD3FF)

struct RainChance: View {
    let hour: HourPoint

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: "drop.fill")
                .foregroundStyle(rainTint)
            Text(Format.percent(hour.precipProb ?? 0))
        }
    }
}

struct WindValue: View {
    let hour: HourPoint
    let unit: WindUnit
    var showDirection = false

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: "wind")
            Text(Format.wind(hour.wind, unit: unit))
            if showDirection, let direction = Format.direction(hour.windDirection) {
                Text(direction)
            }
        }
    }
}

struct SmallWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PlaceTitle(entry: entry)
            Text(Format.temp(entry.now.temperature))
                .font(.system(size: 44, weight: .light))
                .minimumScaleFactor(0.7)
            Spacer(minLength: 0)
            HStack(spacing: 4) {
                WeatherSymbol(code: entry.now.code, isDay: entry.now.isDay)
                Text(WMO.label(entry.now.code))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .font(.system(.caption, weight: .semibold))
            HStack(spacing: 8) {
                RainChance(hour: entry.now)
                WindValue(hour: entry.now, unit: entry.windUnit)
            }
            .font(.system(.caption2, weight: .semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.vertical, 1)
            HighLow(day: entry.today)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct HourColumn: View {
    let hour: HourPoint
    let isFirst: Bool
    let zone: TimeZone
    let unit: WindUnit
    var showWind = false
    var showRainChance = false

    var body: some View {
        VStack(spacing: 3) {
            Text(isFirst ? "Jetzt" : Format.hour(hour.date, zone: zone))
                .font(.system(.caption2, weight: .semibold))
                .opacity(0.9)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            VStack(spacing: 0) {
                WeatherSymbol(code: hour.code, isDay: hour.isDay)
                    .font(.system(size: 17))
                    .frame(height: 20)
                // Chance under the symbol from 20 %, like the Weather app. Reserved in every
                // column once any hour shows one, so temperatures stay aligned.
                if showRainChance {
                    Text(Format.percent(hour.precipProb ?? 0))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(rainTint)
                        .opacity((hour.precipProb ?? 0) >= 20 ? 1 : 0)
                }
            }
            Text(Format.temp(hour.temperature))
                .font(.system(.subheadline, weight: .semibold))
            if showWind {
                HStack(spacing: 1) {
                    Image(systemName: "wind")
                        .font(.system(size: 8, weight: .semibold))
                    Text(Format.wind(hour.wind, unit: unit, withUnit: false))
                }
                .font(.system(size: 10, weight: .semibold))
                .opacity(0.8)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct HourRow: View {
    let entry: WeatherEntry
    var showWind = false

    var body: some View {
        let hours = Array(entry.hours.prefix(6))
        let anyRain = hours.contains { ($0.precipProb ?? 0) >= 20 }
        HStack(spacing: 0) {
            ForEach(Array(hours.enumerated()), id: \.offset) { index, hour in
                HourColumn(
                    hour: hour,
                    isFirst: index == 0,
                    zone: entry.timeZone,
                    unit: entry.windUnit,
                    showWind: showWind,
                    showRainChance: anyRain
                )
            }
        }
    }
}

/// "Regen ab 22 Uhr" on the left, wind with direction and gusts on the right.
struct RainWindBar: View {
    let entry: WeatherEntry

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "umbrella.fill")
                    .foregroundStyle(rainTint)
                Text(entry.rainSummary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 4)
            HStack(spacing: 3) {
                WindValue(hour: entry.now, unit: entry.windUnit, showDirection: true)
                if let gusts = entry.now.gusts, gusts >= entry.now.wind + 10 {
                    Text("· Böen \(Format.wind(gusts, unit: entry.windUnit, withUnit: false))")
                }
            }
            .lineLimit(1)
            .fixedSize()
            .layoutPriority(1)
        }
        .font(.system(.caption, weight: .semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.white.opacity(0.14), in: Capsule())
    }
}

struct MediumHeader: View {
    let entry: WeatherEntry
    var showWind = true

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 0) {
                PlaceTitle(entry: entry)
                Text(Format.temp(entry.now.temperature))
                    .font(.system(size: 40, weight: .light))
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 4) {
                    WeatherSymbol(code: entry.now.code, isDay: entry.now.isDay)
                    Text(WMO.label(entry.now.code))
                        .lineLimit(1)
                }
                .font(.system(.caption, weight: .semibold))
                HighLow(day: entry.today)
                if showWind {
                    WindValue(hour: entry.now, unit: entry.windUnit, showDirection: true)
                        .font(.system(.caption, weight: .semibold))
                }
            }
        }
    }
}

struct MediumWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        VStack(spacing: 0) {
            MediumHeader(entry: entry)
            Spacer(minLength: 4)
            HourRow(entry: entry)
        }
    }
}

struct DayRow: View {
    let day: DayPoint
    let range: ClosedRange<Double>
    let zone: TimeZone

    var body: some View {
        HStack(spacing: 8) {
            Text(Format.weekday(day.date, zone: zone))
                .font(.system(.subheadline, weight: .semibold))
                .frame(width: 46, alignment: .leading)
            VStack(spacing: 0) {
                WeatherSymbol(code: day.code, isDay: true)
                    .font(.system(size: 15))
                if let prob = day.precipProb, prob >= 20 {
                    Text("\(prob) %")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(rainTint)
                }
            }
            .frame(width: 30)
            Text(Format.temp(day.tMin))
                .font(.system(.subheadline, weight: .semibold))
                .opacity(0.7)
                .frame(width: 32, alignment: .trailing)
            TemperatureBar(day: day, range: range)
            Text(Format.temp(day.tMax))
                .font(.system(.subheadline, weight: .semibold))
                .frame(width: 32, alignment: .trailing)
        }
    }
}

/// Weather-app style range bar: the day's span placed on the week's overall range.
struct TemperatureBar: View {
    let day: DayPoint
    let range: ClosedRange<Double>

    var body: some View {
        GeometryReader { proxy in
            let span = max(range.upperBound - range.lowerBound, 1)
            let start = (day.tMin - range.lowerBound) / span
            let end = (day.tMax - range.lowerBound) / span
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.2))
                Capsule()
                    .fill(LinearGradient(
                        colors: [Color(hex: 0x5AC8FA), Color(hex: 0xFFD60A), Color(hex: 0xFF9F0A)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: max(proxy.size.width * (end - start), 6))
                    .offset(x: proxy.size.width * start)
            }
        }
        .frame(height: 5)
    }
}

struct LargeWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        let days = Array(entry.days.prefix(5))
        let low = days.map(\.tMin).min() ?? 0
        let high = days.map(\.tMax).max() ?? 1
        VStack(spacing: 0) {
            MediumHeader(entry: entry, showWind: false)
            RainWindBar(entry: entry)
                .padding(.top, 8)
            HourRow(entry: entry, showWind: true)
                .padding(.top, 8)
            Divider()
                .overlay(.white.opacity(0.35))
                .padding(.vertical, 8)
            // Day rows share the remaining height evenly instead of leaving a gap.
            VStack(spacing: 0) {
                ForEach(days, id: \.date) { day in
                    DayRow(day: day, range: low...max(high, low + 1), zone: entry.timeZone)
                        .frame(maxHeight: .infinity)
                }
            }
        }
    }
}

// MARK: Lock screen

struct CircularWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        if let today = entry.today, today.tMax > today.tMin {
            Gauge(value: min(max(entry.now.temperature, today.tMin), today.tMax), in: today.tMin...today.tMax) {
                Image(systemName: WMO.symbol(entry.now.code, isDay: entry.now.isDay))
            } currentValueLabel: {
                Text(Format.temp(entry.now.temperature))
            } minimumValueLabel: {
                Text("\(Int(today.tMin.rounded()))")
            } maximumValueLabel: {
                Text("\(Int(today.tMax.rounded()))")
            }
            .gaugeStyle(.accessoryCircular)
        } else {
            VStack(spacing: 0) {
                Image(systemName: WMO.symbol(entry.now.code, isDay: entry.now.isDay))
                Text(Format.temp(entry.now.temperature))
                    .font(.system(.headline))
            }
        }
    }
}

struct RectangularWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Image(systemName: WMO.symbol(entry.now.code, isDay: entry.now.isDay))
                Text("\(Format.temp(entry.now.temperature)) \(entry.place.name)")
                    .lineLimit(1)
            }
            .font(.system(.headline))
            .widgetAccentable()
            Text(WMO.label(entry.now.code))
                .lineLimit(1)
            HStack(spacing: 6) {
                RainChance(hour: entry.now)
                WindValue(hour: entry.now, unit: entry.windUnit)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct InlineWeatherView: View {
    let entry: WeatherEntry

    var body: some View {
        Label(
            "\(Format.temp(entry.now.temperature)) \(entry.place.name)",
            systemImage: WMO.symbol(entry.now.code, isDay: entry.now.isDay)
        )
    }
}

struct WeatherWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WeatherEntry

    var body: some View {
        content
            .containerBackground(for: .widget) {
                if isAccessory {
                    Color.clear
                } else {
                    LinearGradient(colors: entry.mood.gradient, startPoint: .top, endPoint: .bottom)
                }
            }
    }

    private var isAccessory: Bool {
        family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline
    }

    @ViewBuilder
    private var content: some View {
        if entry.unavailable {
            VStack(alignment: .leading, spacing: 4) {
                PlaceTitle(entry: entry)
                Text("Keine Daten — App öffnen")
                    .font(.caption)
            }
            .foregroundStyle(isAccessory ? Color.primary : .white)
        } else {
            switch family {
            case .systemMedium:
                MediumWeatherView(entry: entry).foregroundStyle(.white)
            case .systemLarge:
                LargeWeatherView(entry: entry).foregroundStyle(.white)
            case .accessoryCircular:
                CircularWeatherView(entry: entry)
            case .accessoryRectangular:
                RectangularWeatherView(entry: entry)
            case .accessoryInline:
                InlineWeatherView(entry: entry)
            default:
                SmallWeatherView(entry: entry).foregroundStyle(.white)
            }
        }
    }
}

// MARK: - Widget

struct WeatherWidget: Widget {
    let kind = "WeatherWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherProvider()) { entry in
            WeatherWidgetView(entry: entry)
        }
        .configurationDisplayName("Wetter")
        .description("Aktuelles Wetter, die nächsten Stunden und Tage für deinen Ort.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .systemLarge,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

@main
struct WeatherWidgetBundle: WidgetBundle {
    var body: some Widget {
        WeatherWidget()
        WeatherLiveActivity()
    }
}

#Preview(as: .systemMedium) {
    WeatherWidget()
} timeline: {
    WeatherEntry.sample
}
