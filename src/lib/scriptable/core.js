// @ts-nocheck (shared by the Scriptable script and the in-app preview; stripped on export)
// ---------------------------------------------------------------------------
// Wetter CH – gemeinsamer Kern: Daten, Auswertung, Szenen, Detailansicht.
// Kein Scriptable-API hier: die App nutzt denselben Code für die Vorschau.
// ---------------------------------------------------------------------------

export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";

// [Text, SF Symbol Tag, SF Symbol Nacht, Glyphe Tag, Glyphe Nacht] – Glyphen wie in der App
export const WMO = {
  0: ["Klarer Himmel", "sun.max.fill", "moon.stars.fill", "sunny", "nightlight"],
  1: ["Überwiegend klar", "sun.max.fill", "moon.stars.fill", "sunny", "nightlight"],
  2: ["Teilweise bewölkt", "cloud.sun.fill", "cloud.moon.fill", "partly_cloudy_day", "partly_cloudy_night"],
  3: ["Bedeckt", "cloud.fill", null, "cloud"],
  45: ["Nebel", "cloud.fog.fill", null, "foggy"],
  48: ["Reifnebel", "cloud.fog.fill", null, "foggy"],
  51: ["Leichter Nieselregen", "cloud.drizzle.fill", null, "rainy_light"],
  53: ["Nieselregen", "cloud.drizzle.fill", null, "rainy_light"],
  55: ["Starker Nieselregen", "cloud.drizzle.fill", null, "rainy"],
  56: ["Leichter Eisniesel", "cloud.sleet.fill", null, "rainy_light"],
  57: ["Gefrierender Nieselregen", "cloud.sleet.fill", null, "rainy"],
  61: ["Leichter Regen", "cloud.rain.fill", null, "rainy"],
  63: ["Regen", "cloud.rain.fill", null, "rainy"],
  65: ["Starker Regen", "cloud.heavyrain.fill", null, "rainy_heavy"],
  66: ["Leichter Eisregen", "cloud.sleet.fill", null, "rainy"],
  67: ["Eisregen", "cloud.sleet.fill", null, "rainy_heavy"],
  71: ["Leichter Schneefall", "cloud.snow.fill", null, "weather_snowy"],
  73: ["Schneefall", "cloud.snow.fill", null, "weather_snowy"],
  75: ["Starker Schneefall", "snowflake", null, "snowflake"],
  77: ["Schneegriesel", "cloud.snow.fill", null, "weather_snowy"],
  80: ["Leichte Regenschauer", "cloud.sun.rain.fill", "cloud.moon.rain.fill", "rainy"],
  81: ["Regenschauer", "cloud.rain.fill", null, "rainy"],
  82: ["Heftige Regenschauer", "cloud.heavyrain.fill", null, "rainy_heavy"],
  85: ["Leichte Schneeschauer", "cloud.snow.fill", null, "weather_snowy"],
  86: ["Schneeschauer", "snowflake", null, "snowflake"],
  95: ["Gewitter", "cloud.bolt.rain.fill", null, "thunderstorm"],
  96: ["Gewitter mit Hagel", "cloud.hail.fill", null, "weather_hail"],
  99: ["Schweres Gewitter mit Hagel", "cloud.hail.fill", null, "weather_hail"],
};

export function wmo(code, isDay = true) {
  const c = Math.round(Number(code) || 0);
  let e = WMO[c];
  if (!e) {
    if (c <= 19) e = ["Dunst oder Nebel", "cloud.fog.fill", null, "foggy"];
    else if (c <= 29) e = ["Niederschlag in der Nähe", "cloud.rain.fill", null, "rainy"];
    else if (c <= 39) e = ["Schneeverwehung", "wind.snow", null, "weather_snowy"];
    else if (c <= 49) e = ["Nebel", "cloud.fog.fill", null, "foggy"];
    else if (c <= 59) e = ["Nieselregen", "cloud.drizzle.fill", null, "rainy_light"];
    else if (c <= 69) e = ["Regen", "cloud.rain.fill", null, "rainy"];
    else if (c <= 79) e = ["Schnee", "cloud.snow.fill", null, "weather_snowy"];
    else if (c <= 84) e = ["Regenschauer", "cloud.rain.fill", null, "rainy"];
    else if (c <= 94) e = ["Schneeschauer", "cloud.snow.fill", null, "weather_snowy"];
    else e = ["Gewitter", "cloud.bolt.rain.fill", null, "thunderstorm"];
  }
  return {
    label: e[0],
    symbol: !isDay && e[2] ? e[2] : e[1],
    glyph: !isDay && e[4] ? e[4] : e[3],
  };
}

/** Same scenes as the Jetzt card in the app (hail keeps its own effects). */
export function sceneOf(code, isDay) {
  if (code === 96 || code === 99) return "hail";
  if (!isDay && code <= 2) return "night";
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 10 && code <= 19) || (code >= 40 && code <= 49)) return "fog";
  if (code >= 51) return "rain";
  return "cloud";
}

export const SCENES = {
  clear: ["#ffd84a", "#ffba2e", "#ff9d24"],
  partly: ["#2f7fd6", "#5ea3e8", "#86bcef"],
  night: ["#070e26", "#15224a", "#25366a"],
  cloud: ["#5d7289", "#7f93a8", "#95a7b9"],
  rain: ["#34424f", "#4d5e6f", "#65788b"],
  storm: ["#16181f", "#2a2f3d", "#434a5c"],
  hail: ["#16181f", "#2a2f3d", "#434a5c"],
  snow: ["#5a7a9c", "#7894b1", "#92aac2"],
  fog: ["#5b656f", "#75808a", "#88929b"],
};

export function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * factor))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------

export const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const COMPASS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export const temp = (v) => (v == null || !Number.isFinite(v) ? "–" : `${Math.round(v)}°`);
export const pad = (n) => String(n).padStart(2, "0");

export function wind(kmh, unit) {
  if (kmh == null) return "–";
  return unit === "ms" ? `${(kmh / 3.6).toFixed(1).replace(".0", "")} m/s` : `${Math.round(kmh)} km/h`;
}

export function mm(v) {
  return `${(Math.round(v * 10) / 10).toString()} mm`;
}

export function compass(deg) {
  return COMPASS[Math.round((deg || 0) / 22.5) % 16];
}

/** «Altdorf, Kanton Uri, Schweiz» like the card's second line. */
export function placeRegion(place) {
  const parts = [place.name];
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------------

export function forecastUrl(place) {
  const q = {
    latitude: place.latitude,
    longitude: place.longitude,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,precipitation,pressure_msl,cloud_cover",
    hourly: "temperature_2m,weather_code,precipitation_probability,precipitation,is_day,cloud_cover,uv_index",
    minutely_15: "precipitation",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max",
    timezone: "auto",
    forecast_days: 10,
    wind_speed_unit: "kmh",
    models: "best_match",
  };
  return `${FORECAST_URL}?${Object.entries(q)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")}`;
}

/** Open-Meteo sends local wall-clock times; turn them into real instants. */
function parser(offsetSec) {
  return (iso) => Date.parse(`${iso.length === 10 ? `${iso}T00:00` : iso}:00Z`) - offsetSec * 1000;
}

export function normalize(raw, place, fetchedAt = Date.now()) {
  const offset = raw.utc_offset_seconds || 0;
  const at = parser(offset);
  const c = raw.current;
  const h = raw.hourly;
  const d = raw.daily;
  const m = raw.minutely_15 || { time: [], precipitation: [] };
  const pick = (arr, i) => (arr ? arr[i] : null);
  return {
    place,
    offset,
    fetchedAt,
    local: (ts) => new Date(ts + offset * 1000),
    current: {
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      code: c.weather_code,
      isDay: c.is_day === 1,
      wind: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      gusts: c.wind_gusts_10m,
      humidity: c.relative_humidity_2m,
      precip: c.precipitation || 0,
      pressure: c.pressure_msl,
      cloud: c.cloud_cover,
    },
    hours: h.time.map((t, i) => ({
      ts: at(t),
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      prob: h.precipitation_probability[i],
      mm: h.precipitation[i] || 0,
      isDay: h.is_day[i] === 1,
      cloud: pick(h.cloud_cover, i),
      uv: pick(h.uv_index, i),
    })),
    minutes: m.time.map((t, i) => ({ ts: at(t), mm: m.precipitation[i] || 0 })),
    days: d.time.map((t, i) => ({
      date: t,
      ts: at(t),
      code: d.weather_code[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      mm: d.precipitation_sum[i] || 0,
      prob: d.precipitation_probability_max[i],
      sunrise: d.sunrise[i] ? at(d.sunrise[i]) : null,
      sunset: d.sunset[i] ? at(d.sunset[i]) : null,
      uv: d.uv_index_max[i],
    })),
  };
}

// ---------------------------------------------------------------------------
// Auswertung (wie die Jetzt-Karte)
// ---------------------------------------------------------------------------

export function clock(data, ts) {
  const d = data.local(ts);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** «Aktualisiert 23:02» – the device's own clock, not the place's. */
export function statusLine(data, stale) {
  const d = new Date(data.fetchedAt);
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return stale ? `Offline · Stand ${t}` : `Aktualisiert ${t}`;
}

export function hourLabel(data, ts) {
  return `${pad(data.local(ts).getUTCHours())} Uhr`;
}

export function weekday(day, index) {
  if (index === 0) return "Heute";
  return WEEKDAYS[new Date(`${day.date}T12:00:00Z`).getUTCDay()];
}

export function upcomingHours(data, count) {
  const now = Date.now();
  return data.hours.filter((h) => h.ts > now).slice(0, count);
}

export function hourNow(data) {
  const now = Date.now();
  return data.hours.find((h) => h.ts + 3600e3 > now) || data.hours[0];
}

export function upcomingMinutes(data) {
  const now = Date.now();
  return data.minutes.filter((p) => p.ts + 15 * 60e3 > now);
}

/** Rain now / onset, from the 15-minute nowcast and the hourly model. */
export function rain(data) {
  const minutes = upcomingMinutes(data);
  const hNow = hourNow(data);
  const wet = (p) => p.mm >= 0.1;
  const rainingNow = data.current.precip >= 0.1 || (minutes[0] && wet(minutes[0])) || (hNow && hNow.mm >= 0.4);
  if (rainingNow) {
    const dry = minutes.slice(1, 9).find((p) => !wet(p));
    return {
      wet: true,
      onset: null,
      short: "Regen jetzt",
      headline: data.current.precip >= 0.1 ? mm(data.current.precip) : "Niederschlag",
      detail: dry ? `trocken ab ${clock(data, dry.ts)}` : "hält an",
    };
  }
  const soon = minutes.slice(0, 9).find(wet);
  const later = upcomingHours(data, 12).find((h) => h.mm >= 0.4);
  const onset = soon ? soon.ts : later ? later.ts : null;
  return {
    wet: false,
    onset,
    short: onset ? `Regen ab ${clock(data, onset)}` : "Trocken",
    headline: "trocken",
    detail: onset ? `Niederschlag ab ${clock(data, onset)}` : "nächste 12 Std.",
  };
}

export function insight(data) {
  const now = hourNow(data);
  const hrs = upcomingHours(data, 3);
  const later = hrs[1] || hrs[0];
  const out = [];
  if (now && later) {
    if (now.mm >= 0.3 && later.mm < now.mm * 0.45) out.push("Regen lässt nach");
    else if (now.mm < 0.15 && later.mm >= 0.5 && (later.prob == null || later.prob >= 45))
      out.push(`ab ${clock(data, later.ts)} Regen`);
    const clear = data.hours.find((h) => h.ts > Date.now() && h.cloud != null && h.cloud <= 25 && h.code <= 1);
    const cloud = now.cloud != null ? now.cloud : data.current.cloud;
    if (clear && cloud >= 55) out.push(`ab ${clock(data, clear.ts)} klar`);
    else if (cloud <= 25 && now.code <= 1) out.push("weiterhin klar");
    if (now.code >= 95) out.push(wmo(now.code, now.isDay).label);
    if (later.temp - now.temp >= 3) out.push("es wird milder");
    else if (now.temp - later.temp >= 3) out.push("es kühlt ab");
  }
  if (out.length) return [...new Set(out)].slice(0, 2).join(" · ");
  return `${wmo(data.current.code, data.current.isDay).label} bleibt vorerst ähnlich`;
}

/** «leichte Kleidung reicht, trocken» – the clothing line of the card. */
export function clothing(data) {
  const cur = data.current;
  if (cur.temp == null || cur.feels == null) return null;
  const now = hourNow(data);
  const idx = data.hours.indexOf(now);
  const next3 = data.hours.slice(Math.max(0, idx), Math.max(0, idx) + 3);
  const uv = now && now.uv != null ? now.uv : data.days[0] ? data.days[0].uv : null;
  const precipNow = cur.precip + (now ? now.mm : 0);
  const precipSoon = next3.reduce((s, h) => s + h.mm, 0);
  const prob = next3.map((h) => h.prob).find((v) => v != null);
  let index = cur.feels;
  if (cur.temp <= 10 && cur.wind >= 8) {
    const v = Math.max(cur.wind, 4.8);
    index = 13.12 + 0.6215 * cur.temp - 11.37 * v ** 0.16 + 0.3965 * cur.temp * v ** 0.16;
  }
  let rec = "leichte Kleidung reicht";
  if (precipNow >= 0.4 || (precipSoon >= 0.8 && prob != null && prob >= 50)) rec = "Schirm einpacken";
  else if (uv != null && uv >= 6 && cur.isDay) rec = "Sonnencreme";
  else if (index <= 8 || cur.temp <= 10) rec = "Jacke";
  else if (index <= 14 || cur.wind >= 28) rec = "leichte Jacke";
  const minutes = upcomingMinutes(data);
  const nowMm = now ? now.mm : 0;
  const rainingNow = nowMm >= 0.4 || (minutes[0] && minutes[0].mm >= 0.1);
  const parts = [rec];
  if (nowMm < 0.25 && !rainingNow) {
    const r = rain(data);
    parts.push(r.onset ? `trocken bis ${clock(data, r.onset)}` : "trocken");
  } else if (rainingNow) parts.push("jetzt nass");
  return parts.join(", ");
}

export function metricsLine(data) {
  const c = data.current;
  const parts = [];
  if (c.humidity != null) parts.push(`Feuchte ${Math.round(c.humidity)} %`);
  if (c.pressure != null) parts.push(`Druck ${Math.round(c.pressure).toLocaleString("de-CH")} hPa`);
  if (c.cloud != null) parts.push(`Bewölkung ${Math.round(c.cloud)} %`);
  return parts.join(" · ");
}

export function sunLine(data) {
  const t = data.days[0];
  if (!t || !t.sunrise || !t.sunset) return null;
  return `Sonne ${clock(data, t.sunrise)} – ${clock(data, t.sunset)}`;
}

export function todayRange(data) {
  const t = data.days[0];
  return t ? `Heute ${temp(t.min)} bis ${temp(t.max)}` : "";
}

export const TEMP_STOPS = [
  [-15, [94, 92, 230]],
  [-5, [10, 132, 255]],
  [3, [100, 210, 255]],
  [10, [48, 209, 88]],
  [17, [255, 214, 10]],
  [24, [255, 159, 10]],
  [31, [255, 69, 58]],
];

/** Temperature colour of the day bars as #rrggbb. */
export function tempHex(t) {
  let c = TEMP_STOPS[TEMP_STOPS.length - 1][1];
  if (t <= TEMP_STOPS[0][0]) c = TEMP_STOPS[0][1];
  else {
    for (let i = 1; i < TEMP_STOPS.length; i++) {
      const [t1, c1] = TEMP_STOPS[i];
      const [t0, c0] = TEMP_STOPS[i - 1];
      if (t <= t1) {
        const f = (t - t0) / (t1 - t0);
        c = c0.map((v, k) => v + (c1[k] - v) * f);
        break;
      }
    }
  }
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------
// Szene (Standbild der animierten Jetzt-Karte)
//
// `g` zeichnet: linear(x, y, w, h, stops), radial(cx, cy, rx, ry, stops),
// ellipse(cx, cy, rx, ry, rgba), poly(points, rgba), line(x1, y1, x2, y2, width, rgba).
// Farben sind [r, g, b, a]; stops sind [[t, rgba], …] mit t von 0 bis 1.
// ---------------------------------------------------------------------------

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W_ = (a) => [255, 255, 255, a];

function cloudPuff(g, cx, cy, w, alpha) {
  const h = w * 0.42;
  g.radial(cx - w * 0.24, cy + h * 0.12, w * 0.26, h * 0.42, [[0, W_(alpha * 0.9)], [1, W_(0)]]);
  g.radial(cx, cy - h * 0.06, w * 0.3, h * 0.56, [[0, W_(alpha)], [1, W_(0)]]);
  g.radial(cx + w * 0.24, cy + h * 0.1, w * 0.26, h * 0.4, [[0, W_(alpha * 0.8)], [1, W_(0)]]);
  g.radial(cx, cy + h * 0.3, w * 0.48, h * 0.3, [[0, W_(alpha * 0.7)], [1, W_(0)]]);
}

function rays(g, cx, cy, len, alpha) {
  for (let deg = 0; deg < 360; deg += 15) {
    const a0 = (deg * Math.PI) / 180;
    const a1 = ((deg + 4.5) * Math.PI) / 180;
    g.poly(
      [
        [cx, cy],
        [cx + Math.cos(a0) * len, cy + Math.sin(a0) * len],
        [cx + Math.cos(a1) * len, cy + Math.sin(a1) * len],
      ],
      W_(alpha)
    );
  }
}

function streaks(g, W, H, rnd, alpha, len, stepX, stepY) {
  for (let y = -len; y < H + len; y += stepY) {
    for (let x = -10; x < W + 10; x += stepX) {
      const jx = x + rnd() * stepX * 0.8;
      const jy = y + rnd() * stepY * 0.8;
      g.line(jx, jy, jx - len * 0.27, jy + len, 1.1, W_(alpha * (0.6 + rnd() * 0.4)));
    }
  }
}

/** Paints sky and atmosphere for `scene` into a W×H card; `glyph` = {x, y, size}. */
export function paintScene(g, scene, W, H, glyph) {
  const sky = (SCENES[scene] || SCENES.cloud).map(hexRgb);
  g.linear(0, 0, W, H, [
    [0, [...sky[0], 1]],
    [0.55, [...sky[1], 1]],
    [1, [...sky[2], 1]],
  ]);
  const gx = glyph.x;
  const gy = glyph.y;
  const gs = glyph.size;
  const big = Math.max(W, H);
  const rnd = seeded(Math.round(W * 7 + H * 13));

  if (scene === "clear") {
    rays(g, gx, gy, big * 0.9, 0.07);
    g.radial(gx, gy, big * 0.62, big * 0.62, [
      [0, [255, 255, 240, 0.9]],
      [0.16, [255, 236, 140, 0.55]],
      [0.38, [255, 200, 60, 0.18]],
      [0.62, [255, 200, 60, 0]],
      [1, [255, 200, 60, 0]],
    ]);
    g.radial(0, H * 1.1, W * 1.2, H * 0.6, [[0, [255, 120, 0, 0.22]], [1, [255, 120, 0, 0]]]);
  } else if (scene === "partly") {
    rays(g, gx, gy, big * 0.7, 0.035);
    g.radial(gx, gy, big * 0.5, big * 0.5, [
      [0, [255, 250, 220, 0.6]],
      [0.2, [255, 220, 110, 0.28]],
      [0.55, [255, 220, 110, 0]],
      [1, [255, 220, 110, 0]],
    ]);
    cloudPuff(g, W * 0.3, H * 0.2, W * 0.7, 0.34);
    cloudPuff(g, W * 0.62, H * 0.55, W * 0.55, 0.22);
  } else if (scene === "night") {
    g.radial(gx, gy, big * 0.55, big * 0.55, [
      [0, [214, 224, 255, 0.36]],
      [0.3, [120, 140, 230, 0.16]],
      [0.6, [120, 140, 230, 0]],
      [1, [120, 140, 230, 0]],
    ]);
    const count = Math.round((W * H) / 700);
    for (let i = 0; i < count; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      if (Math.hypot(x - gx, y - gy) < gs * 0.9) continue;
      const r = 0.45 + rnd() * 0.85;
      g.ellipse(x, y, r, r, W_(0.35 + rnd() * 0.65));
    }
  } else if (scene === "cloud") {
    cloudPuff(g, W * 0.32, H * 0.14, W * 0.72, 0.36);
    cloudPuff(g, W * 0.7, H * 0.46, W * 0.55, 0.24);
    cloudPuff(g, W * 0.4, H * 0.82, W * 0.8, 0.18);
  } else if (scene === "rain" || scene === "storm" || scene === "hail") {
    cloudPuff(g, W * 0.45, -H * 0.02, W * 0.95, 0.3);
    streaks(g, W, H, rnd, 0.3, 11, 18, 26);
    if (scene === "storm" || scene === "hail") {
      g.radial(W * 0.5, 0, W * 0.8, H * 0.5, [[0, W_(0.18)], [1, W_(0)]]);
    }
    if (scene === "hail") {
      for (let i = 0; i < Math.round((W * H) / 1600); i++) {
        const r = 1.2 + rnd() * 1;
        g.ellipse(rnd() * W, rnd() * H, r, r, W_(0.55 + rnd() * 0.3));
      }
    }
  } else if (scene === "snow") {
    const count = Math.round((W * H) / 550);
    for (let i = 0; i < count; i++) {
      const depth = rnd();
      const r = depth < 0.4 ? 1 + rnd() * 0.6 : depth < 0.8 ? 1.8 + rnd() * 0.8 : 2.6 + rnd() * 0.8;
      g.ellipse(rnd() * W, rnd() * H, r, r, W_(depth < 0.4 ? 0.45 : 0.85));
    }
    g.linear(0, H * 0.74, W, H * 0.26, [[0, W_(0)], [1, W_(0.22)]]);
  } else if (scene === "fog") {
    g.radial(W * 0.45, H * 0.2, W * 0.9, H * 0.18, [[0, W_(0.34)], [1, W_(0)]]);
    g.radial(W * 0.6, H * 0.52, W * 0.95, H * 0.17, [[0, W_(0.26)], [1, W_(0)]]);
    g.radial(W * 0.4, H * 0.84, W * 0.9, H * 0.19, [[0, W_(0.3)], [1, W_(0)]]);
  }
}

// ---------------------------------------------------------------------------
// Detailansicht (HTML mit Animation) – beim Antippen eines Widgets
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

const DETAIL_CSS = `
:root{color-scheme:light dark;--bg:#f2f2f7;--card:#fff;--ink:#1c1c1e;--muted:#6e6e73;--line:rgb(0 0 0/.08)}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1c1c1e;--ink:#f5f5f7;--muted:#98989d;--line:rgb(255 255 255/.1)}}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--ink);font:15px/1.35 -apple-system,system-ui,sans-serif;padding:max(16px,env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));-webkit-text-size-adjust:100%}
.card{background:var(--card);border-radius:22px;padding:16px 18px;margin-bottom:14px;overflow:hidden}
.card h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.02em;color:var(--muted);margin-bottom:10px}
svg{fill:currentColor;display:block}
.hero{position:relative;isolation:isolate;color:#fff;padding:20px;text-shadow:0 1px 2px rgb(0 0 0/.14)}
.hero[data-scene=clear]{color:#3a2300;text-shadow:0 1px 0 rgb(255 245 200/.45)}
.wash,.fx{position:absolute;inset:0;z-index:-1;pointer-events:none}
.fx{overflow:hidden;border-radius:inherit}
.fx i{position:absolute;inset:0;display:none}
.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.status,.region,.soft{opacity:.78;font-size:14px}
.place{font-size:28px;font-weight:600;letter-spacing:-.01em;line-height:1.15;margin-top:2px}
.glyph{position:relative;width:72px;height:72px;flex:none}
.glyph svg{width:72px;height:72px}
.now{display:flex;align-items:center;gap:12px;margin:14px 0 4px}
.temp{font-size:86px;font-weight:200;letter-spacing:-.02em;line-height:1}
.label{font-size:19px;font-weight:500}
.lines{margin-top:12px;display:grid;gap:4px;font-size:16px}
.lines b{font-weight:500}
.strip{margin-top:14px;border-radius:16px;padding:14px;background:rgb(255 255 255/.16);box-shadow:inset 0 0 0 .5px rgb(255 255 255/.18)}
.hero[data-scene=clear] .strip{background:rgb(255 255 255/.3);box-shadow:inset 0 0 0 .5px rgb(255 255 255/.5)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.k{font-size:13px;opacity:.8;display:flex;gap:4px;align-items:center}
.v{font-size:21px;font-weight:600;margin-top:2px}
.d{font-size:13px;opacity:.78}
.meta{margin-top:12px;font-size:13px;opacity:.85}
.foot{display:flex;justify-content:space-between;margin-top:14px;font-size:14px;opacity:.8}
.hours{display:flex;gap:14px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.hours::-webkit-scrollbar{display:none}
.h{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:44px;font-size:13px}
.h svg{width:26px;height:26px}
.h .t{font-size:16px;font-weight:600}
.p{color:#0a84ff;font-size:11px;font-weight:600;min-height:13px}
.day{display:grid;grid-template-columns:52px 28px 38px 34px 1fr 34px;align-items:center;gap:8px;padding:7px 0;border-top:.5px solid var(--line)}
.day:first-of-type{border-top:0}
.day svg{width:24px;height:24px}
.day .n{font-weight:600}.day .lo{color:var(--muted);text-align:right}.day .hi{font-weight:600;text-align:right}
.track{position:relative;height:6px;border-radius:9px;background:var(--line)}
.track span{position:absolute;top:0;bottom:0;border-radius:9px}
.track em{position:absolute;top:50%;width:9px;height:9px;border-radius:9px;background:#fff;box-shadow:0 0 0 1.5px rgb(0 0 0/.35);transform:translate(-50%,-50%)}
.bars{display:flex;align-items:flex-end;gap:6px;height:64px}
.bars span{flex:1;border-radius:4px;background:var(--line)}
.bars span.w{background:#64d2ff}
.ticks{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:6px}
.src{text-align:center;font-size:12px;color:var(--muted);margin-top:6px}
.src a{color:#0a84ff;text-decoration:none}
/* Szenen – wie die Jetzt-Karte */
.hero{--sun-x:calc(100% - 56px);--sun-y:56px}
.wash[data-s=clear]{background:radial-gradient(circle at var(--sun-x) var(--sun-y),#fffbe8 0%,#ffe888 12%,rgb(255 214 64/0) 48%),linear-gradient(165deg,#ffd84a,#ffba2e 48%,#ff9d24)}
.wash[data-s=partly]{background:radial-gradient(circle at var(--sun-x) var(--sun-y),rgb(255 236 150/.75),rgb(255 214 90/.25) 18%,rgb(255 214 90/0) 42%),linear-gradient(180deg,#2f7fd6,#5ea3e8 60%,#86bcef)}
.wash[data-s=night]{background:linear-gradient(180deg,#070e26,#15224a 55%,#25366a)}
.wash[data-s=cloud]{background:linear-gradient(180deg,#5d7289,#7f93a8 55%,#95a7b9)}
.wash[data-s=rain]{background:linear-gradient(180deg,#34424f,#4d5e6f 55%,#65788b)}
.wash[data-s=storm],.wash[data-s=hail]{background:linear-gradient(180deg,#16181f,#2a2f3d 50%,#434a5c)}
.wash[data-s=snow]{background:linear-gradient(180deg,#5a7a9c,#7894b1 55%,#92aac2)}
.wash[data-s=fog]{background:linear-gradient(180deg,#5b656f,#75808a 55%,#88929b)}
@media (prefers-color-scheme:dark){.wash{filter:brightness(.72) saturate(.9)}.wash[data-s=clear]{filter:brightness(.9) saturate(.95)}}
.fx[data-s=clear] .a{display:block;inset:auto;top:calc(var(--sun-y) - 176px);right:-120px;width:352px;height:352px;border-radius:50%;background:radial-gradient(circle,rgb(255 255 240/.9),rgb(255 236 140/.55) 16%,rgb(255 200 60/.18) 38%,transparent 62%);animation:sun 5s ease-in-out infinite}
.fx[data-s=clear] .b,.fx[data-s=partly] .d{display:block;inset:auto;top:calc(var(--sun-y) - 352px);right:-296px;width:704px;height:704px;background:repeating-conic-gradient(from 0deg,rgb(255 255 255/.3) 0deg 3.5deg,rgb(255 255 255/0) 5deg 13deg,rgb(255 255 255/.3) 15deg);-webkit-mask-image:radial-gradient(circle,#000,rgb(0 0 0/.55) 18%,transparent 52%);mask-image:radial-gradient(circle,#000,rgb(0 0 0/.55) 18%,transparent 52%);animation:spin 80s linear infinite}
.fx[data-s=partly] .d{opacity:.45}
.fx[data-s=clear] .c{display:block;background:radial-gradient(120% 60% at 0% 110%,rgb(255 120 0/.22),transparent 70%);animation:sun 9s ease-in-out infinite reverse}
.fx[data-s=partly] .a{display:block;inset:auto;top:calc(var(--sun-y) - 176px);right:-120px;width:352px;height:352px;border-radius:50%;background:radial-gradient(circle,rgb(255 250 220/.6),rgb(255 220 110/.28) 20%,transparent 55%);animation:sun 6s ease-in-out infinite}
.fx[data-s=night] .a{display:block;inset:auto;top:calc(var(--sun-y) - 176px);right:-120px;width:352px;height:352px;border-radius:50%;background:radial-gradient(circle,rgb(214 224 255/.36),rgb(120 140 230/.16) 30%,transparent 60%);animation:sun 9s ease-in-out infinite}
.fx[data-s=night] .b,.fx[data-s=night] .c{display:block;background-image:radial-gradient(circle at 12% 18%,#fff 0 1px,transparent 1.5px),radial-gradient(circle at 46% 8%,rgb(255 255 255/.8) 0 .8px,transparent 1.3px),radial-gradient(circle at 78% 34%,#fff 0 1.1px,transparent 1.6px),radial-gradient(circle at 30% 56%,rgb(255 255 255/.7) 0 .7px,transparent 1.2px),radial-gradient(circle at 64% 72%,rgb(255 255 255/.85) 0 .9px,transparent 1.4px),radial-gradient(circle at 90% 88%,rgb(255 255 255/.7) 0 .8px,transparent 1.3px);background-size:144px 112px;animation:twinkle 3.6s ease-in-out infinite}
.fx[data-s=night] .c{background-size:208px 176px;background-position:64px 48px;animation-duration:5.2s;animation-delay:-2.1s}
.fx[data-s=night] .d{display:block;inset:auto;top:14%;left:8%;width:112px;height:1px;border-radius:9px;background:linear-gradient(90deg,transparent,rgb(255 255 255/.9));transform-origin:right center;opacity:0;animation:shoot 13s ease-in infinite 4s}
.fx[data-s=cloud] .a,.fx[data-s=cloud] .b,.fx[data-s=cloud] .c,.fx[data-s=partly] .b,.fx[data-s=partly] .c,.fx[data-s=rain] .d,.fx[data-s=storm] .d,.fx[data-s=hail] .d{display:block;inset:auto;top:0;left:0;width:70%;height:42%;background:radial-gradient(ellipse 26% 42% at 26% 62%,rgb(255 255 255/.34),transparent 72%),radial-gradient(ellipse 30% 56% at 50% 44%,rgb(255 255 255/.38),transparent 72%),radial-gradient(ellipse 26% 40% at 74% 60%,rgb(255 255 255/.3),transparent 72%),radial-gradient(ellipse 48% 30% at 50% 74%,rgb(255 255 255/.26),transparent 74%);animation:drift 46s linear infinite -18s}
.fx[data-s=cloud] .b,.fx[data-s=partly] .c{top:34%;width:55%;opacity:.7;animation-duration:64s;animation-delay:-44s}
.fx[data-s=cloud] .c{top:66%;width:80%;opacity:.55;animation-duration:80s;animation-delay:-12s}
.fx[data-s=rain] .d,.fx[data-s=storm] .d,.fx[data-s=hail] .d{top:-8%;width:90%;opacity:.55;animation-duration:38s;animation-delay:-20s}
.fx[data-s=rain] .a,.fx[data-s=storm] .a,.fx[data-s=hail] .a{display:block;background-image:linear-gradient(165deg,transparent 40%,rgb(255 255 255/.32) 40% 42%,transparent 42%);background-size:18px 28px;opacity:.75;animation:rain .55s linear infinite}
.fx[data-s=rain] .b,.fx[data-s=storm] .b{display:block;background-image:linear-gradient(168deg,transparent 52%,rgb(255 255 255/.2) 52% 53.5%,transparent 53.5%);background-size:26px 38px;opacity:.55;animation:rainb .85s linear infinite}
.fx[data-s=storm] .c,.fx[data-s=hail] .c{display:block;background:rgb(255 255 255/.38);opacity:0;animation:flash 8s ease-in-out infinite}
.fx[data-s=hail] .b{display:block;background-image:radial-gradient(circle at 18% 22%,rgb(255 255 255/.82) 0 2.2px,transparent 2.6px),radial-gradient(circle at 62% 8%,rgb(255 255 255/.7) 0 1.8px,transparent 2.1px),radial-gradient(circle at 84% 46%,rgb(255 255 255/.78) 0 2px,transparent 2.4px),radial-gradient(circle at 36% 68%,rgb(255 255 255/.66) 0 1.6px,transparent 1.9px),radial-gradient(circle at 72% 86%,rgb(255 255 255/.74) 0 1.9px,transparent 2.2px);opacity:.7;animation:hail 1.55s linear infinite}
.fx[data-s=snow] .a,.fx[data-s=snow] .b,.fx[data-s=snow] .c{display:block;top:-144px;left:-24px;right:-24px;background-image:radial-gradient(circle at 10% 12%,#fff 0 2.7px,transparent 3.5px),radial-gradient(circle at 58% 6%,rgb(255 255 255/.9) 0 2.1px,transparent 2.9px),radial-gradient(circle at 84% 40%,#fff 0 3px,transparent 3.8px),radial-gradient(circle at 34% 50%,rgb(255 255 255/.85) 0 1.9px,transparent 2.7px),radial-gradient(circle at 70% 78%,#fff 0 2.4px,transparent 3.2px),radial-gradient(circle at 20% 88%,rgb(255 255 255/.9) 0 2.2px,transparent 3px);background-size:144px 144px;--fall:144px;animation:fall 7s linear infinite,sway 3.5s ease-in-out infinite alternate}
.fx[data-s=snow] .b{top:-96px;background-size:96px 96px;background-position:32px 16px;opacity:.75;--fall:96px;animation-duration:6.5s,4.5s;animation-delay:-2s,-1.5s}
.fx[data-s=snow] .c{top:-64px;background-size:64px 64px;background-position:16px 32px;opacity:.45;--fall:64px;animation-duration:7.5s,5.5s;animation-delay:-4s,-3s}
.fx[data-s=snow] .d{display:block;background:linear-gradient(0deg,rgb(255 255 255/.22),transparent 26%)}
.fx[data-s=fog] .a,.fx[data-s=fog] .b,.fx[data-s=fog] .c{display:block;left:-40%;width:180%;background:linear-gradient(90deg,transparent,rgb(255 255 255/.36) 20%,rgb(255 255 255/.12) 42%,rgb(255 255 255/.4) 64%,transparent 88%);filter:blur(20px)}
.fx[data-s=fog] .a{top:4%;height:34%;animation:fog 18s ease-in-out infinite alternate}
.fx[data-s=fog] .b{top:36%;height:32%;opacity:.8;animation:fog 26s ease-in-out infinite alternate-reverse}
.fx[data-s=fog] .c{top:66%;height:36%;animation:fog 22s ease-in-out infinite alternate -9s}
.fx[data-s=fog] .d{display:block;background:linear-gradient(180deg,rgb(255 255 255/.1),rgb(255 255 255/.28));animation:breathe 12s ease-in-out infinite}
.glyph::before{content:"";position:absolute;inset:-35%;border-radius:50%;z-index:-1;opacity:0}
.glyph[data-s=clear] svg{color:#fffbe6;filter:drop-shadow(0 0 6px rgb(255 170 0/.95)) drop-shadow(0 0 16px rgb(255 140 0/.55));animation:spin 40s linear infinite}
.glyph[data-s=clear]::before{background:radial-gradient(circle,rgb(255 250 210/.95),rgb(255 208 70/.6) 32%,transparent 66%);animation:glow 3.2s ease-in-out infinite}
.glyph[data-s=partly] svg{filter:drop-shadow(0 0 8px rgb(255 220 120/.7));animation:drift2 7s ease-in-out infinite}
.glyph[data-s=cloud] svg{animation:drift2 7s ease-in-out infinite}
.glyph[data-s=night] svg{color:#f3f1ff;filter:drop-shadow(0 0 8px rgb(190 200 255/.8));animation:rock 8s ease-in-out infinite}
.glyph[data-s=night]::before{background:radial-gradient(circle,rgb(220 228 255/.5),transparent 62%);animation:glow 5s ease-in-out infinite}
.glyph[data-s=rain] svg{animation:bob 2.4s ease-in-out infinite}
.glyph[data-s=snow] svg{animation:rock 4s ease-in-out infinite}
.glyph[data-s=storm]::before,.glyph[data-s=hail]::before{background:radial-gradient(circle,rgb(255 255 255/.9),transparent 60%);animation:flash 8s ease-in-out infinite}
.glyph[data-s=fog] svg{animation:breathe 6s ease-in-out infinite}
@keyframes sun{0%,100%{transform:scale(1);opacity:.82}50%{transform:scale(1.08);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes drift{from{transform:translateX(-100%)}to{transform:translateX(145%)}}
@keyframes drift2{0%,100%{transform:translateX(-3px)}50%{transform:translateX(4px)}}
@keyframes twinkle{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes shoot{0%,88%{opacity:0;transform:translate(0,0) rotate(18deg) scaleX(.3)}90%{opacity:1}96%,100%{opacity:0;transform:translate(192px,62px) rotate(18deg) scaleX(1)}}
@keyframes rain{to{background-position:6px 28px}}
@keyframes rainb{to{background-position:-6px 38px}}
@keyframes hail{to{background-position:6% 100%}}
@keyframes flash{0%,88%,91%,93.4%,100%{opacity:0}89.2%{opacity:.32}90%{opacity:.06}92.2%{opacity:.16}}
@keyframes fall{to{transform:translateY(var(--fall))}}
@keyframes sway{from{translate:-10px 0}to{translate:10px 0}}
@keyframes fog{from{transform:translateX(-14%)}to{transform:translateX(14%)}}
@keyframes breathe{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes glow{0%,100%{opacity:.7;transform:scale(.96)}50%{opacity:1;transform:scale(1.06)}}
@keyframes rock{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;

/** Full animated detail page for the Scriptable WebView (and the in-app preview). */
export function detailHtml(data, glyphs, opts = {}) {
  const cur = data.current;
  const info = wmo(cur.code, cur.isDay);
  const scene = sceneOf(cur.code, cur.isDay);
  const g = (name) => glyphs[name] || "";
  const r = rain(data);
  const cloth = clothing(data);
  const sun = sunLine(data);
  const hours = [{ label: "Jetzt", t: cur.temp, code: cur.code, isDay: cur.isDay, prob: null }].concat(
    upcomingHours(data, 23).map((h) => ({ label: hourLabel(data, h.ts), t: h.temp, code: h.code, isDay: h.isDay, prob: h.prob }))
  );
  const days = data.days.slice(0, 10);
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  const mins = upcomingMinutes(data).slice(0, 8);
  const maxMm = Math.max(1, ...mins.map((p) => p.mm));
  const stamp = statusLine(data, opts.stale);

  const hourCells = hours
    .map(
      (h) => `<div class="h"><span>${esc(h.label)}</span>${g(wmo(h.code, h.isDay).glyph)}<span class="p">${
        h.prob != null && h.prob >= 20 ? `${Math.round(h.prob)}%` : ""
      }</span><span class="t">${temp(h.t)}</span></div>`
    )
    .join("");
  const dayRows = days
    .map((d, i) => {
      const left = ((d.min - lo) / span) * 100;
      const width = Math.max(4, ((d.max - d.min) / span) * 100);
      const dot = i === 0 ? `<em style="left:${((cur.temp - lo) / span) * 100}%"></em>` : "";
      return `<div class="day"><span class="n">${weekday(d, i)}</span>${g(wmo(d.code, true).glyph)}<span class="p">${
        d.prob != null && d.prob >= 20 ? `${Math.round(d.prob)}%` : ""
      }</span><span class="lo">${temp(d.min)}</span><div class="track"><span style="left:${left}%;width:${width}%;background:linear-gradient(90deg,${tempHex(
        d.min
      )},${tempHex(d.max)})"></span>${dot}</div><span class="hi">${temp(d.max)}</span></div>`;
    })
    .join("");
  const bars = mins.map((p) => `<span class="${p.mm >= 0.1 ? "w" : ""}" style="height:${Math.max(6, (p.mm / maxMm) * 100)}%"></span>`).join("");
  const ticks = mins.length
    ? [0, Math.floor(mins.length / 2), mins.length - 1].map((i) => `<span>${clock(data, mins[i].ts)}</span>`).join("")
    : "";

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(
    data.place.name
  )}</title><style>${DETAIL_CSS}</style></head><body>
<section class="card hero" data-scene="${scene}">
<div class="wash" data-s="${scene}"></div>
<div class="fx" data-s="${scene}"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i></div>
<div class="top"><div><p class="status">${esc(stamp)}</p><h1 class="place">${esc(data.place.name)}</h1><p class="region">${esc(
    placeRegion(data.place)
  )}</p></div><div class="glyph" data-s="${scene}">${g(info.glyph)}</div></div>
<div class="now"><p class="temp">${temp(cur.temp)}</p><div><p class="label">${esc(info.label)}</p><p class="soft">Gefühlt ${temp(
    cur.feels
  )}</p></div></div>
<div class="lines"><p><b>${esc(insight(data))}</b></p>${cloth ? `<p>${esc(cloth)}</p>` : ""}</div>
<div class="strip"><div class="pair"><div><p class="k">Regen</p><p class="v">${esc(r.headline)}</p><p class="d">${esc(
    r.detail
  )}</p></div><div><p class="k">Wind</p><p class="v">${wind(cur.wind, opts.wind)}</p><p class="d">aus ${compass(cur.windDir)} · Böen ${wind(
    cur.gusts,
    opts.wind
  )}</p></div></div><p class="meta">${esc(metricsLine(data))}</p>${sun ? `<p class="meta">${esc(sun)}</p>` : ""}</div>
<div class="foot"><span>${esc(todayRange(data))}</span></div>
</section>
<section class="card"><h2>Nächste 24 Stunden</h2><div class="hours">${hourCells}</div></section>
<section class="card"><h2>Regen · nächste 2 Std. · ${esc(r.short)}</h2><div class="bars">${bars}</div><div class="ticks">${ticks}</div></section>
<section class="card"><h2>10 Tage</h2>${dayRows}</section>
<p class="src">Daten: Open-Meteo${opts.appUrl ? ` · <a href="${esc(opts.appUrl)}">Web-App im Browser öffnen</a>` : ""}</p>
</body></html>`;
}
