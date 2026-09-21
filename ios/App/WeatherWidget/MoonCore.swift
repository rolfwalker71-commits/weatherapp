import Foundation

/// Moon phase, illumination, main phase instants and rise/set — mirrors src/lib/moon.ts.
/// Main phases follow Meeus, "Astronomical Algorithms" ch. 49 (a few minutes accurate);
/// position, illumination and rise/set follow the low-precision suncalc approach.
enum MoonPhaseKind: CaseIterable {
    case new, first, full, last

    var offset: Double {
        switch self {
        case .new: 0
        case .first: 0.25
        case .full: 0.5
        case .last: 0.75
        }
    }

    var label: String {
        switch self {
        case .new: "Neumond"
        case .first: "Zunehmender Halbmond"
        case .full: "Vollmond"
        case .last: "Abnehmender Halbmond"
        }
    }

    var shortLabel: String {
        switch self {
        case .new: "Neumond"
        case .first: "Erstes Viertel"
        case .full: "Vollmond"
        case .last: "Letztes Viertel"
        }
    }
}

struct MoonInfo {
    /// Days since the last new moon.
    let age: Double
    /// 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
    let cycle: Double
    /// Illuminated fraction of the disk, 0 … 1.
    let illumination: Double
    let waxing: Bool
    let label: String

    /// SF Symbol for inline lock screen widgets.
    var symbol: String {
        switch cycle {
        case ..<0.03, 0.97...: "moonphase.new.moon"
        case ..<0.22: "moonphase.waxing.crescent"
        case ..<0.28: "moonphase.first.quarter"
        case ..<0.47: "moonphase.waxing.gibbous"
        case ..<0.53: "moonphase.full.moon"
        case ..<0.72: "moonphase.waning.gibbous"
        case ..<0.78: "moonphase.last.quarter"
        default: "moonphase.waning.crescent"
        }
    }
}

struct MoonEvent {
    enum Kind { case rise, set }
    let kind: Kind
    let date: Date
}

struct MoonDay {
    let events: [MoonEvent]
    let alwaysUp: Bool
    let alwaysDown: Bool
}

enum MoonCalc {
    static let synodic = 29.530588853
    private static let rad = Double.pi / 180
    private static let dayS = 86_400.0
    private static let j1970 = 2_440_588.0
    private static let j2000 = 2_451_545.0
    private static let obliquity = rad * 23.4397
    /// 2000-01-06T18:14Z, the reference new moon (k = 0).
    private static let epoch = 947_182_440.0

    // MARK: Main phases (Meeus ch. 49)

    static func phaseInstant(_ k: Double, _ phase: MoonPhaseKind) -> Date {
        let T = k / 1236.85
        let T2 = T * T, T3 = T2 * T, T4 = T3 * T
        let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4
        let E = 1 - 0.002516 * T - 0.0000074 * T2
        let M = rad * (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3)
        let Mp = rad * (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4)
        let F = rad * (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4)
        let Om = rad * (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3)
        var c: Double
        switch phase {
        case .new, .full:
            let n = phase == .new
            c = (n ? -0.4072 : -0.40614) * sin(Mp)
            c += (n ? 0.17241 : 0.17302) * E * sin(M)
            c += (n ? 0.01608 : 0.01614) * sin(2 * Mp)
            c += (n ? 0.01039 : 0.01043) * sin(2 * F)
            c += (n ? 0.00739 : 0.00734) * E * sin(Mp - M)
            c -= (n ? 0.00514 : 0.00515) * E * sin(Mp + M)
            c += (n ? 0.00208 : 0.00209) * E * E * sin(2 * M)
            c -= 0.00111 * sin(Mp - 2 * F)
            c -= 0.00057 * sin(Mp + 2 * F)
            c += 0.00056 * E * sin(2 * Mp + M)
            c -= 0.00042 * sin(3 * Mp)
            c += 0.00042 * E * sin(M + 2 * F)
            c += 0.00038 * E * sin(M - 2 * F)
            c -= 0.00024 * E * sin(2 * Mp - M)
            c -= 0.00017 * sin(Om)
        case .first, .last:
            c = -0.62801 * sin(Mp)
            c += 0.17172 * E * sin(M)
            c -= 0.01183 * E * sin(Mp + M)
            c += 0.00862 * sin(2 * Mp)
            c += 0.00804 * sin(2 * F)
            c += 0.00454 * E * sin(Mp - M)
            c += 0.00204 * E * E * sin(2 * M)
            c -= 0.0018 * sin(Mp - 2 * F)
            c -= 0.0007 * sin(Mp + 2 * F)
            c -= 0.0004 * sin(3 * Mp)
            c -= 0.00034 * E * sin(2 * Mp - M)
            c += 0.00032 * E * sin(M + 2 * F)
            c += 0.00032 * E * sin(M - 2 * F)
            c -= 0.00028 * E * E * sin(Mp + 2 * M)
            c += 0.00027 * E * sin(2 * Mp + M)
            c -= 0.00017 * sin(Om)
            var W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp)
            W += -0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F)
            c += phase == .first ? W : -W
        }
        // JDE is Terrestrial Time; ΔT ≈ 69 s in the 2020s.
        return Date(timeIntervalSince1970: (jde + c - j1970 + 0.5) * dayS - 69)
    }

    /// Lunation index of the last new moon at or before `date`.
    private static func lunationBefore(_ date: Date) -> Double {
        let k = floor((date.timeIntervalSince1970 - epoch) / (synodic * dayS))
        return phaseInstant(k + 1, .new) <= date ? k + 1 : k
    }

    /// The next `count` main phases strictly after `from`, in order.
    static func nextPhases(from: Date, count: Int) -> [(phase: MoonPhaseKind, date: Date)] {
        var result: [(phase: MoonPhaseKind, date: Date)] = []
        var k = lunationBefore(from) - 1
        while result.count < count {
            for phase in MoonPhaseKind.allCases {
                let date = phaseInstant(k + phase.offset, phase)
                if date > from { result.append((phase, date)) }
                if result.count >= count { break }
            }
            k += 1
        }
        return result
    }

    // MARK: Position & illumination (suncalc)

    private static func toDays(_ date: Date) -> Double {
        date.timeIntervalSince1970 / dayS - 0.5 + j1970 - j2000
    }

    private static func rightAscension(_ l: Double, _ b: Double) -> Double {
        atan2(sin(l) * cos(obliquity) - tan(b) * sin(obliquity), cos(l))
    }

    private static func declination(_ l: Double, _ b: Double) -> Double {
        asin(sin(b) * cos(obliquity) + cos(b) * sin(obliquity) * sin(l))
    }

    private static func sunCoords(_ d: Double) -> (dec: Double, ra: Double) {
        let M = rad * (357.5291 + 0.98560028 * d)
        let C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M))
        let L = M + C + rad * 102.9372 + .pi
        return (declination(L, 0), rightAscension(L, 0))
    }

    private static func moonCoords(_ d: Double) -> (ra: Double, dec: Double, dist: Double) {
        let L = rad * (218.316 + 13.176396 * d)
        let M = rad * (134.963 + 13.064993 * d)
        let F = rad * (93.272 + 13.22935 * d)
        let l = L + rad * 6.289 * sin(M)
        let b = rad * 5.128 * sin(F)
        return (rightAscension(l, b), declination(l, b), 385_001 - 20_905 * cos(M))
    }

    private static func moonAltitude(_ date: Date, lat: Double, lon: Double) -> Double {
        let d = toDays(date)
        let c = moonCoords(d)
        let phi = rad * lat
        let H = rad * (280.16 + 360.9856235 * d) + rad * lon - c.ra
        let h = asin(sin(phi) * sin(c.dec) + cos(phi) * cos(c.dec) * cos(H))
        let hr = max(h, 0)
        return h + 0.0002967 / tan(hr + 0.00312536 / (hr + 0.08901179))
    }

    private static func illuminatedFraction(_ date: Date) -> Double {
        let d = toDays(date)
        let sun = sunCoords(d)
        let moon = moonCoords(d)
        let sunDist = 149_598_000.0
        let phi = acos(sin(sun.dec) * sin(moon.dec) + cos(sun.dec) * cos(moon.dec) * cos(sun.ra - moon.ra))
        let inc = atan2(sunDist * sin(phi), moon.dist - sunDist * cos(phi))
        return (1 + cos(inc)) / 2
    }

    // MARK: Public

    static func info(at date: Date) -> MoonInfo {
        let k = lunationBefore(date)
        let lastNew = phaseInstant(k, .new)
        let nextNew = phaseInstant(k + 1, .new)
        let cycle = date.timeIntervalSince(lastNew) / nextNew.timeIntervalSince(lastNew)

        // Within a day of a main phase instant, the day carries that phase's name.
        var label: String?
        let candidates: [(Double, MoonPhaseKind)] = [(k, .new), (k, .first), (k, .full), (k, .last), (k + 1, .new)]
        for (kk, phase) in candidates {
            let at = phaseInstant(kk + phase.offset, phase)
            if abs(date.timeIntervalSince(at)) < dayS {
                label = phase.label
                break
            }
        }
        let fallback = cycle < 0.25 ? "Zunehmende Sichel"
            : cycle < 0.5 ? "Zunehmender Mond"
            : cycle < 0.75 ? "Abnehmender Mond"
            : "Abnehmende Sichel"
        return MoonInfo(
            age: cycle * synodic,
            cycle: cycle,
            illumination: illuminatedFraction(date),
            waxing: cycle < 0.5,
            label: label ?? fallback
        )
    }

    /// Rise and set within [start, start + 24 h) at the given location.
    static func times(start: Date, lat: Double, lon: Double) -> MoonDay {
        let hc = 0.133 * rad
        func alt(_ hours: Double) -> Double {
            moonAltitude(start.addingTimeInterval(hours * 3600), lat: lat, lon: lon) - hc
        }
        var h0 = alt(0)
        var rise: Double?
        var set: Double?
        var ye = 0.0
        var i = 1.0
        while i <= 24 {
            let h1 = alt(i)
            let h2 = alt(i + 1)
            let a = (h0 + h2) / 2 - h1
            let b = (h2 - h0) / 2
            let xe = -b / (2 * a)
            ye = (a * xe + b) * xe + h1
            let d = b * b - 4 * a * h1
            var roots = 0
            var x1 = 0.0
            var x2 = 0.0
            if d >= 0 {
                let dx = d.squareRoot() / (abs(a) * 2)
                x1 = xe - dx
                x2 = xe + dx
                if abs(x1) <= 1 { roots += 1 }
                if abs(x2) <= 1 { roots += 1 }
                if x1 < -1 { x1 = x2 }
            }
            if roots == 1 {
                if h0 < 0 { rise = i + x1 } else { set = i + x1 }
            } else if roots == 2 {
                rise = i + (ye < 0 ? x2 : x1)
                set = i + (ye < 0 ? x1 : x2)
            }
            if rise != nil && set != nil { break }
            h0 = h2
            i += 2
        }
        var events: [MoonEvent] = []
        if let rise { events.append(MoonEvent(kind: .rise, date: start.addingTimeInterval(rise * 3600))) }
        if let set { events.append(MoonEvent(kind: .set, date: start.addingTimeInterval(set * 3600))) }
        events.sort { $0.date < $1.date }
        let none = events.isEmpty
        return MoonDay(events: events, alwaysUp: none && ye > 0, alwaysDown: none && ye <= 0)
    }

    /// Rise/set during the local calendar day of `date` in `zone`.
    static func day(of date: Date, zone: TimeZone, lat: Double, lon: Double) -> MoonDay {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return times(start: calendar.startOfDay(for: date), lat: lat, lon: lon)
    }
}
