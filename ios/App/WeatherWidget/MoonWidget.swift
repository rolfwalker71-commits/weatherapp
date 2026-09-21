import SwiftUI
import WidgetKit

// MARK: - Timeline

struct MoonEntry: TimelineEntry {
    let date: Date
    let place: WidgetPlace
    let timeZone: TimeZone
    let info: MoonInfo
    let today: MoonDay
    let phases: [(phase: MoonPhaseKind, date: Date)]

    var southern: Bool { place.latitude < 0 }

    static func make(date: Date, place: WidgetPlace, zone: TimeZone) -> MoonEntry {
        MoonEntry(
            date: date,
            place: place,
            timeZone: zone,
            info: MoonCalc.info(at: date),
            today: MoonCalc.day(of: date, zone: zone, lat: place.latitude, lon: place.longitude),
            phases: MoonCalc.nextPhases(from: date, count: 4)
        )
    }

    /// Next `count` local days starting today, with the phase at local noon.
    func strip(days count: Int) -> [MoonStripDay] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let start = calendar.startOfDay(for: date)
        let end = calendar.date(byAdding: .day, value: count, to: start) ?? start
        let mains = MoonCalc.nextPhases(from: start, count: 4).filter { $0.date < end }
        return (0..<count).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset, to: start),
                  let noon = calendar.date(byAdding: .hour, value: 12, to: day) else { return nil }
            let main = mains.first { calendar.isDate($0.date, inSameDayAs: day) }?.phase
            return MoonStripDay(date: day, cycle: MoonCalc.info(at: noon).cycle, main: main, isToday: offset == 0)
        }
    }
}

struct MoonStripDay: Hashable {
    let date: Date
    let cycle: Double
    let main: MoonPhaseKind?
    let isToday: Bool
}

struct MoonProvider: TimelineProvider {
    func placeholder(in context: Context) -> MoonEntry {
        .make(date: Date(), place: .bern, zone: .current)
    }

    func getSnapshot(in context: Context, completion: @escaping (MoonEntry) -> Void) {
        let place = context.isPreview ? .bern : WidgetPlace.load()
        completion(.make(date: Date(), place: place, zone: Self.zone(for: place)))
    }

    /// Everything is computed on device: hourly entries for a day, no network needed.
    func getTimeline(in context: Context, completion: @escaping (Timeline<MoonEntry>) -> Void) {
        let place = WidgetPlace.load()
        let zone = Self.zone(for: place)
        let now = Date()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let nextHour = calendar.dateInterval(of: .hour, for: now)?.end ?? now.addingTimeInterval(3600)
        let entries = [MoonEntry.make(date: now, place: place, zone: zone)]
            + (0..<24).map { MoonEntry.make(date: nextHour.addingTimeInterval(Double($0) * 3600), place: place, zone: zone) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    /// The place's zone from the weather widget's cached forecast; the device zone otherwise.
    static func zone(for place: WidgetPlace) -> TimeZone {
        struct Zone: Decodable {
            let timezone: String?
            let utc_offset_seconds: Int?
        }
        let key = "\(SharedStore.cacheKey).\(place.latitude),\(place.longitude)"
        guard let data = SharedStore.defaults.data(forKey: key),
              let raw = try? JSONDecoder().decode(Zone.self, from: data) else { return .current }
        if let id = raw.timezone, let zone = TimeZone(identifier: id) { return zone }
        if let offset = raw.utc_offset_seconds, let zone = TimeZone(secondsFromGMT: offset) { return zone }
        return .current
    }
}

// MARK: - Formatting

enum MoonFormat {
    static func time(_ date: Date, zone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_CH")
        formatter.timeZone = zone
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    /// e.g. "Sa. 26.9."
    static func date(_ date: Date, zone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_CH")
        formatter.timeZone = zone
        formatter.dateFormat = "EEEEEE d.M."
        return formatter.string(from: date)
    }

    static func weekday(_ date: Date, zone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_CH")
        formatter.timeZone = zone
        formatter.dateFormat = "EEEEEE"
        return formatter.string(from: date)
    }

    static func dayNumber(_ date: Date, zone: TimeZone) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return "\(calendar.component(.day, from: date))"
    }

    static func percent(_ info: MoonInfo) -> String {
        "\(Int((info.illumination * 100).rounded())) %"
    }

    /// "↓ 01:07  ↑ 17:19", or a note when the moon stays up or down all day.
    static func riseSet(_ day: MoonDay, zone: TimeZone) -> String {
        if day.alwaysUp { return "Ganzer Tag sichtbar" }
        if day.alwaysDown { return "Heute nicht sichtbar" }
        return day.events
            .map { "\($0.kind == .rise ? "↑" : "↓") \(time($0.date, zone: zone))" }
            .joined(separator: "  ")
    }
}

// MARK: - Moon drawing

/// Lit part of the disk: the bright limb closed by the elliptical terminator.
struct MoonLitShape: Shape {
    let cycle: Double

    func path(in rect: CGRect) -> Path {
        let r = min(rect.width, rect.height) / 2
        let cx = rect.midX
        let cy = rect.midY
        let p = cycle.truncatingRemainder(dividingBy: 1)
        let waxing = p < 0.5
        let k = cos(2 * .pi * p)
        let steps = 48
        var path = Path()
        // Down along the limb, back up along the terminator.
        for i in 0...steps {
            let dy = -r + 2 * r * Double(i) / Double(steps)
            let w = (r * r - dy * dy).squareRoot()
            let x = waxing ? cx + w : cx - w
            let point = CGPoint(x: x, y: cy + dy)
            if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        for i in stride(from: steps, through: 0, by: -1) {
            let dy = -r + 2 * r * Double(i) / Double(steps)
            let w = (r * r - dy * dy).squareRoot()
            let x = waxing ? cx + w * k : cx - w * k
            path.addLine(to: CGPoint(x: x, y: cy + dy))
        }
        path.closeSubpath()
        return path
    }
}

let moonLight = Color(hex: 0xF3E9C6)

struct MoonDisk: View {
    let cycle: Double
    var southern = false
    /// Lock screen widgets render monochrome; use the primary tint instead of moonlight.
    var accessory = false

    var body: some View {
        ZStack {
            Circle().fill((accessory ? Color.primary : .white).opacity(accessory ? 0.25 : 0.16))
            MoonLitShape(cycle: cycle)
                .fill(accessory ? Color.primary : moonLight)
                .shadow(color: accessory ? .clear : moonLight.opacity(0.45), radius: 3)
            Circle().stroke((accessory ? Color.primary : .white).opacity(0.25), lineWidth: 0.75)
        }
        .aspectRatio(1, contentMode: .fit)
        .rotationEffect(.degrees(southern ? 180 : 0))
    }
}

// MARK: - Views

struct MoonTitle: View {
    let entry: MoonEntry

    var body: some View {
        HStack(spacing: 3) {
            Text("Mond · \(entry.place.name)")
                .lineLimit(1)
            if entry.place.isCurrentLocation == true {
                Image(systemName: "location.fill")
                    .font(.system(size: 9, weight: .semibold))
            }
        }
        .font(.system(.subheadline, weight: .semibold))
    }
}

struct SmallMoonView: View {
    let entry: MoonEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            MoonTitle(entry: entry)
            Spacer(minLength: 4)
            MoonDisk(cycle: entry.info.cycle, southern: entry.southern)
                .frame(width: 52, height: 52)
            Spacer(minLength: 4)
            Text(entry.info.label)
                .font(.system(.caption, weight: .semibold))
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            Text("\(MoonFormat.percent(entry.info)) beleuchtet")
                .font(.system(.caption2, weight: .semibold))
                .opacity(0.8)
            Text(MoonFormat.riseSet(entry.today, zone: entry.timeZone))
                .font(.system(.caption2, weight: .semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct MoonHeader: View {
    let entry: MoonEntry

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            MoonDisk(cycle: entry.info.cycle, southern: entry.southern)
                .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 1) {
                MoonTitle(entry: entry)
                Text(entry.info.label)
                    .font(.system(.headline))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("\(MoonFormat.percent(entry.info)) beleuchtet · \(entry.info.waxing ? "zunehmend" : "abnehmend")")
                    .font(.system(.caption2, weight: .semibold))
                    .opacity(0.8)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 2) {
                if entry.today.alwaysUp || entry.today.alwaysDown {
                    Text(MoonFormat.riseSet(entry.today, zone: entry.timeZone))
                        .multilineTextAlignment(.trailing)
                } else {
                    ForEach(Array(entry.today.events.enumerated()), id: \.offset) { _, event in
                        Text("\(event.kind == .rise ? "↑" : "↓") \(MoonFormat.time(event.date, zone: entry.timeZone))")
                    }
                }
            }
            .font(.system(.caption, weight: .semibold))
            .monospacedDigit()
            .fixedSize()
        }
    }
}

struct MoonStrip: View {
    let entry: MoonEntry
    let days: [MoonStripDay]

    var body: some View {
        HStack(spacing: 2) {
            ForEach(days, id: \.self) { day in
                VStack(spacing: 3) {
                    Text(day.isToday ? "Heute" : MoonFormat.weekday(day.date, zone: entry.timeZone))
                        .font(.system(size: 9, weight: .semibold))
                        .opacity(0.85)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    MoonDisk(cycle: day.cycle, southern: entry.southern)
                        .frame(width: 18, height: 18)
                    Text(MoonFormat.dayNumber(day.date, zone: entry.timeZone))
                        .font(.system(size: 11, weight: .semibold))
                        .monospacedDigit()
                }
                .padding(.vertical, 4)
                .frame(maxWidth: .infinity)
                .background {
                    if day.main != nil {
                        RoundedRectangle(cornerRadius: 8).fill(moonLight.opacity(0.18))
                    } else if day.isToday {
                        RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.5), lineWidth: 1)
                    }
                }
            }
        }
    }
}

struct MediumMoonView: View {
    let entry: MoonEntry

    var body: some View {
        VStack(spacing: 0) {
            MoonHeader(entry: entry)
            Spacer(minLength: 6)
            MoonStrip(entry: entry, days: entry.strip(days: 7))
        }
    }
}

struct PhaseRow: View {
    let entry: MoonEntry
    let phase: MoonPhaseKind
    let date: Date

    var body: some View {
        HStack(spacing: 8) {
            MoonDisk(cycle: phase.offset, southern: entry.southern)
                .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: 0) {
                Text(phase.shortLabel)
                    .font(.system(.caption, weight: .semibold))
                    .lineLimit(1)
                Text("\(MoonFormat.date(date, zone: entry.timeZone)) · \(MoonFormat.time(date, zone: entry.timeZone))")
                    .font(.system(.caption2, weight: .semibold))
                    .monospacedDigit()
                    .opacity(0.8)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
    }
}

struct LargeMoonView: View {
    let entry: MoonEntry

    var body: some View {
        let days = entry.strip(days: 14)
        VStack(spacing: 0) {
            MoonHeader(entry: entry)
            Divider()
                .overlay(.white.opacity(0.35))
                .padding(.vertical, 10)
            Text("Nächste Phasen")
                .font(.system(.caption, weight: .bold))
                .textCase(.uppercase)
                .opacity(0.7)
                .frame(maxWidth: .infinity, alignment: .leading)
            Grid(horizontalSpacing: 12, verticalSpacing: 10) {
                ForEach(0..<2, id: \.self) { row in
                    GridRow {
                        ForEach(0..<2, id: \.self) { column in
                            let index = row * 2 + column
                            if index < entry.phases.count {
                                PhaseRow(entry: entry, phase: entry.phases[index].phase, date: entry.phases[index].date)
                            }
                        }
                    }
                }
            }
            .padding(.top, 6)
            Spacer(minLength: 10)
            Text("Die nächsten 14 Tage")
                .font(.system(.caption, weight: .bold))
                .textCase(.uppercase)
                .opacity(0.7)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 4)
            VStack(spacing: 4) {
                MoonStrip(entry: entry, days: Array(days.prefix(7)))
                MoonStrip(entry: entry, days: Array(days.dropFirst(7)))
            }
        }
    }
}

// MARK: Lock screen

struct CircularMoonView: View {
    let entry: MoonEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 1) {
                MoonDisk(cycle: entry.info.cycle, southern: entry.southern, accessory: true)
                    .frame(width: 26, height: 26)
                Text(MoonFormat.percent(entry.info))
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
            }
        }
        .widgetAccentable()
    }
}

struct RectangularMoonView: View {
    let entry: MoonEntry

    var body: some View {
        HStack(spacing: 8) {
            MoonDisk(cycle: entry.info.cycle, southern: entry.southern, accessory: true)
                .frame(width: 34, height: 34)
                .widgetAccentable()
            VStack(alignment: .leading, spacing: 0) {
                Text(entry.info.label)
                    .font(.system(.headline))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("\(MoonFormat.percent(entry.info)) beleuchtet")
                    .lineLimit(1)
                Text(MoonFormat.riseSet(entry.today, zone: entry.timeZone))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct InlineMoonView: View {
    let entry: MoonEntry

    var body: some View {
        Label("\(entry.info.label) \(MoonFormat.percent(entry.info))", systemImage: entry.info.symbol)
    }
}

struct MoonWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: MoonEntry

    var body: some View {
        content
            .containerBackground(for: .widget) {
                if isAccessory {
                    Color.clear
                } else {
                    LinearGradient(colors: WeatherMood.night.gradient, startPoint: .top, endPoint: .bottom)
                }
            }
    }

    private var isAccessory: Bool {
        family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemMedium:
            MediumMoonView(entry: entry).foregroundStyle(.white)
        case .systemLarge:
            LargeMoonView(entry: entry).foregroundStyle(.white)
        case .accessoryCircular:
            CircularMoonView(entry: entry)
        case .accessoryRectangular:
            RectangularMoonView(entry: entry)
        case .accessoryInline:
            InlineMoonView(entry: entry)
        default:
            SmallMoonView(entry: entry).foregroundStyle(.white)
        }
    }
}

// MARK: - Widget

struct MoonWidget: Widget {
    let kind = "MoonWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MoonProvider()) { entry in
            MoonWidgetView(entry: entry)
        }
        .configurationDisplayName("Mond")
        .description("Mondphase, Auf- und Untergang und die nächsten Phasen für deinen Ort.")
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

#Preview(as: .systemMedium) {
    MoonWidget()
} timeline: {
    MoonEntry.make(date: Date(), place: .bern, zone: .current)
}
