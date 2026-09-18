import ActivityKit
import SwiftUI
import WidgetKit

// Lock screen and Dynamic Island for "Regen im Anmarsch" and "Unwetter aktiv".
// Data model: Shared/WeatherActivityAttributes.swift.

private typealias Context = ActivityViewContext<WeatherActivityAttributes>

private extension WeatherActivityAttributes.ContentState {
    /// Meteoalarm colours: 1–2 yellow, 3 orange, 4 red.
    var levelColor: Color {
        switch level {
        case 4: return Color(hex: 0xFF453A)
        case 3: return Color(hex: 0xFF9F0A)
        default: return Color(hex: 0xFFD60A)
        }
    }
}

private func accent(_ context: Context) -> Color {
    context.attributes.kind == "warning" ? context.state.levelColor : rainTint
}

private func background(_ context: Context) -> Color {
    context.attributes.kind == "warning" ? Color(hex: 0x241A12) : Color(hex: 0x14202E)
}

/// "in 12 Min." counting down while rain is coming, "bis 21:30" once it rains or a warning runs.
/// `compact` drops the "bis" for the narrow Dynamic Island slot.
private struct TimeLabel: View {
    let state: WeatherActivityAttributes.ContentState
    var compact = false

    var body: some View {
        if let start = state.startsAt, start > Date() {
            // Minute precision: the lock screen blanks out ticking seconds ("11:--").
            if #available(iOS 18.0, *) {
                Text(.currentDate, format: .reference(to: start, allowedFields: [.hour, .minute]))
                    .monospacedDigit()
            } else {
                Text(start, style: .time)
            }
        } else if let end = state.endsAt {
            if compact {
                Text(end, style: .time)
            } else {
                Text("bis \(end, style: .time)")
            }
        } else {
            Text("jetzt")
        }
    }
}

/// Next two hours in 15-minute steps, Weather-app style.
private struct RainBars: View {
    let series: [Double]

    var body: some View {
        // Scale to at least 0.5 mm so drizzle stays low, but any wet step is clearly visible.
        let peak = max(series.max() ?? 0, 0.5)
        VStack(spacing: 3) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(Array(series.enumerated()), id: \.offset) { _, value in
                    let wet = value >= 0.1
                    RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                        .fill(wet ? rainTint : .white.opacity(0.18))
                        .frame(width: 10, height: wet ? max(8, 30 * min(value / peak, 1)) : 3)
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 30, alignment: .bottom)
            HStack {
                Text("Jetzt")
                Spacer()
                Text("+1 h")
                Spacer()
                Text("+2 h")
            }
            .font(.system(size: 10, weight: .semibold))
            .opacity(0.6)
        }
    }
}

private struct LockScreenView: View {
    let context: Context

    var body: some View {
        let state = context.state
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: state.symbol)
                    .symbolRenderingMode(.multicolor)
                    .font(.title3)
                VStack(alignment: .leading, spacing: 1) {
                    Text(state.headline)
                        .font(.headline)
                    Text(context.attributes.place)
                        .font(.caption.weight(.semibold))
                        .opacity(0.7)
                }
                Spacer(minLength: 4)
                TimeLabel(state: state)
                    .font(.system(.title3, weight: .semibold))
                    .foregroundStyle(accent(context))
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 110, alignment: .trailing)
            }
            if context.attributes.kind == "rain", !state.series.isEmpty {
                RainBars(series: state.series)
            }
            if context.attributes.kind == "warning" {
                Capsule()
                    .fill(state.levelColor)
                    .frame(height: 4)
            }
            Text(state.detail)
                .font(.subheadline)
                .opacity(0.85)
                .lineLimit(2)
        }
        .foregroundStyle(.white)
        .padding(16)
    }
}

struct WeatherLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WeatherActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(background(context).opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(context.attributes.place).lineLimit(1)
                    } icon: {
                        Image(systemName: context.state.symbol).symbolRenderingMode(.multicolor)
                    }
                    .font(.subheadline.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimeLabel(state: context.state)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(accent(context))
                        .lineLimit(1)
                        .fixedSize()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.state.headline).font(.headline)
                        if context.attributes.kind == "rain", !context.state.series.isEmpty {
                            RainBars(series: context.state.series)
                        } else {
                            Text(context.state.detail).font(.subheadline).opacity(0.8).lineLimit(2)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.symbol)
                    .symbolRenderingMode(.multicolor)
            } compactTrailing: {
                TimeLabel(state: context.state, compact: true)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent(context))
                    .lineLimit(1)
                    .frame(maxWidth: 64)
            } minimal: {
                Image(systemName: context.state.symbol)
                    .symbolRenderingMode(.multicolor)
            }
            .keylineTint(accent(context))
        }
    }
}

#Preview("Regen", as: .content, using: WeatherActivityAttributes(kind: "rain", place: "Zürich")) {
    WeatherLiveActivity()
} contentStates: {
    WeatherActivityAttributes.ContentState(
        headline: "Regen ab 20:55",
        detail: "mässig · etwa 3 mm in der nächsten Stunde",
        symbol: "cloud.rain.fill",
        startsAt: Date().addingTimeInterval(12 * 60),
        endsAt: nil,
        series: [0, 0.1, 0.6, 1.2, 0.9, 0.4, 0.1, 0],
        level: 0
    )
}
