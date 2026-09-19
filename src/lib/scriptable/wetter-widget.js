// @ts-nocheck (runs in Scriptable, not in the app; stripped on export)
// Wetter CH — Widget für Scriptable (https://scriptable.app)
// Erzeugt in der App unter Einstellungen › Scriptable-Widgets.
// Daten: Open-Meteo (wie die App), kein Konto und kein Schlüssel nötig.
//
// Widget-Parameter (optional, lange auf das Widget drücken › Widget bearbeiten):
//   gps          – immer den aktuellen Standort zeigen
//   Zürich       – einen anderen Ort zeigen (Ortsname)
//   leer         – den in der App gewählten Ort

const CONFIG = "__CONFIG__";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.cacheDirectory(), "wetter-ch-widget");
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);

// ---------------------------------------------------------------------------
// Wettercodes (WMO) – Texte wie in der App, Symbole als SF Symbols
// ---------------------------------------------------------------------------

const WMO = {
  0: ["Klarer Himmel", "sun.max.fill", "moon.stars.fill"],
  1: ["Überwiegend klar", "sun.max.fill", "moon.stars.fill"],
  2: ["Teilweise bewölkt", "cloud.sun.fill", "cloud.moon.fill"],
  3: ["Bedeckt", "cloud.fill"],
  45: ["Nebel", "cloud.fog.fill"],
  48: ["Reifnebel", "cloud.fog.fill"],
  51: ["Leichter Nieselregen", "cloud.drizzle.fill"],
  53: ["Nieselregen", "cloud.drizzle.fill"],
  55: ["Starker Nieselregen", "cloud.drizzle.fill"],
  56: ["Leichter Eisniesel", "cloud.sleet.fill"],
  57: ["Gefrierender Nieselregen", "cloud.sleet.fill"],
  61: ["Leichter Regen", "cloud.rain.fill"],
  63: ["Regen", "cloud.rain.fill"],
  65: ["Starker Regen", "cloud.heavyrain.fill"],
  66: ["Leichter Eisregen", "cloud.sleet.fill"],
  67: ["Eisregen", "cloud.sleet.fill"],
  71: ["Leichter Schneefall", "cloud.snow.fill"],
  73: ["Schneefall", "cloud.snow.fill"],
  75: ["Starker Schneefall", "snowflake"],
  77: ["Schneegriesel", "cloud.snow.fill"],
  80: ["Leichte Regenschauer", "cloud.sun.rain.fill", "cloud.moon.rain.fill"],
  81: ["Regenschauer", "cloud.rain.fill"],
  82: ["Heftige Regenschauer", "cloud.heavyrain.fill"],
  85: ["Leichte Schneeschauer", "cloud.snow.fill"],
  86: ["Schneeschauer", "snowflake"],
  95: ["Gewitter", "cloud.bolt.rain.fill"],
  96: ["Gewitter mit Hagel", "cloud.hail.fill"],
  99: ["Schweres Gewitter mit Hagel", "cloud.hail.fill"],
};

function wmo(code, isDay = true) {
  const c = Math.round(Number(code) || 0);
  let e = WMO[c];
  if (!e) {
    if (c <= 19) e = ["Dunst oder Nebel", "cloud.fog.fill"];
    else if (c <= 29) e = ["Niederschlag in der Nähe", "cloud.rain.fill"];
    else if (c <= 39) e = ["Schneeverwehung", "wind.snow"];
    else if (c <= 49) e = ["Nebel", "cloud.fog.fill"];
    else if (c <= 59) e = ["Nieselregen", "cloud.drizzle.fill"];
    else if (c <= 69) e = ["Regen", "cloud.rain.fill"];
    else if (c <= 79) e = ["Schnee", "cloud.snow.fill"];
    else if (c <= 84) e = ["Regenschauer", "cloud.rain.fill"];
    else if (c <= 94) e = ["Schneeschauer", "cloud.snow.fill"];
    else e = ["Gewitter", "cloud.bolt.rain.fill"];
  }
  return { label: e[0], symbol: !isDay && e[2] ? e[2] : e[1] };
}

/** Same scenes as the Jetzt card in the app. */
function sceneOf(code, isDay) {
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

const SCENES = {
  clear: ["#ffd84a", "#ffba2e", "#ff9d24"],
  partly: ["#2f7fd6", "#5ea3e8", "#86bcef"],
  night: ["#070e26", "#15224a", "#25366a"],
  cloud: ["#5d7289", "#7f93a8", "#95a7b9"],
  rain: ["#34424f", "#4d5e6f", "#65788b"],
  storm: ["#16181f", "#2a2f3d", "#434a5c"],
  snow: ["#5a7a9c", "#7894b1", "#92aac2"],
  fog: ["#5b656f", "#75808a", "#88929b"],
};

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * factor))).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

function themeFor(scene) {
  const stops = SCENES[scene] || SCENES.cloud;
  const darkFactor = scene === "clear" ? 0.9 : 0.72;
  const g = new LinearGradient();
  g.colors = stops.map((hex) => Color.dynamic(new Color(hex), new Color(shade(hex, darkFactor))));
  g.locations = [0, 0.55, 1];
  g.startPoint = new Point(0.2, 0);
  g.endPoint = new Point(0.8, 1);
  const light = scene === "clear";
  const ink = light ? "#3a2300" : "#ffffff";
  return {
    gradient: g,
    text: new Color(ink),
    muted: new Color(ink, light ? 0.72 : 0.78),
    faint: new Color(ink, light ? 0.18 : 0.22),
    sun: light ? new Color("#3a2300") : new Color("#ffd60a"),
    outline: light ? new Color(ink, 0.45) : null,
    prob: new Color(light ? "#0a5ea8" : "#9ad8ff"),
  };
}

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const COMPASS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

const temp = (v) => (v == null || !Number.isFinite(v) ? "–" : `${Math.round(v)}°`);
const pad = (n) => String(n).padStart(2, "0");

function wind(kmh) {
  if (kmh == null) return "–";
  return CONFIG.wind === "ms" ? `${(kmh / 3.6).toFixed(1).replace(".0", "")} m/s` : `${Math.round(kmh)} km/h`;
}

function mm(v) {
  return `${(Math.round(v * 10) / 10).toString()} mm`;
}

// ---------------------------------------------------------------------------
// Ort
// ---------------------------------------------------------------------------

function readCache(name) {
  const file = fm.joinPath(cacheDir, name);
  if (!fm.fileExists(file)) return null;
  try {
    return JSON.parse(fm.readString(file));
  } catch (e) {
    return null;
  }
}

function writeCache(name, value) {
  fm.writeString(fm.joinPath(cacheDir, name), JSON.stringify(value));
}

async function gpsPlace() {
  try {
    Location.setAccuracyToThreeKilometers();
    const loc = await Location.current();
    let name = "Aktueller Standort";
    try {
      const geo = await Location.reverseGeocode(loc.latitude, loc.longitude, "de");
      const g = geo && geo[0];
      if (g) name = g.locality || g.subLocality || g.subAdministrativeArea || name;
    } catch (e) {}
    const place = { name, latitude: loc.latitude, longitude: loc.longitude, gps: true };
    writeCache("gps.json", place);
    return place;
  } catch (e) {
    // Widgets bekommen nicht immer einen Standort: letzten bekannten nehmen.
    return readCache("gps.json") || CONFIG.fallback;
  }
}

async function searchPlace(query) {
  const key = `geo-${query.toLowerCase().replace(/[^a-z0-9äöüéèà]/g, "_")}.json`;
  const cached = readCache(key);
  if (cached) return cached;
  try {
    const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=de&format=json`;
    const json = await new Request(url).loadJSON();
    const hit = json.results && json.results[0];
    if (!hit) return null;
    const place = { name: hit.name, latitude: hit.latitude, longitude: hit.longitude };
    writeCache(key, place);
    return place;
  } catch (e) {
    return null;
  }
}

async function resolvePlace() {
  const param = String(args.widgetParameter || "").trim();
  const lower = param.toLowerCase();
  if (lower === "gps" || lower === "standort") return gpsPlace();
  if (param) {
    const found = await searchPlace(param);
    if (found) return found;
  }
  return CONFIG.place ? CONFIG.place : gpsPlace();
}

// ---------------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------------

function forecastUrl(place) {
  const q = {
    latitude: place.latitude,
    longitude: place.longitude,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,precipitation,cloud_cover",
    hourly: "temperature_2m,weather_code,precipitation_probability,precipitation,is_day,cloud_cover",
    minutely_15: "precipitation",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max",
    timezone: "auto",
    forecast_days: 10,
    wind_speed_unit: "kmh",
    models: "best_match",
  };
  return `${FORECAST_URL}?${Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/** Open-Meteo sends local wall-clock times; turn them into real instants. */
function parser(offsetSec) {
  return (iso) => Date.parse(`${iso.length === 10 ? `${iso}T00:00` : iso}:00Z`) - offsetSec * 1000;
}

function normalize(raw, place) {
  const offset = raw.utc_offset_seconds || 0;
  const at = parser(offset);
  const local = (ts) => new Date(ts + offset * 1000);
  const c = raw.current;
  const h = raw.hourly;
  const d = raw.daily;
  const m = raw.minutely_15 || { time: [], precipitation: [] };
  return {
    place,
    offset,
    fetchedAt: Date.now(),
    local,
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
      cloud: c.cloud_cover,
    },
    hours: h.time.map((t, i) => ({
      ts: at(t),
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      prob: h.precipitation_probability[i],
      mm: h.precipitation[i] || 0,
      isDay: h.is_day[i] === 1,
      cloud: h.cloud_cover ? h.cloud_cover[i] : null,
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

async function loadWeather() {
  const place = await resolvePlace();
  if (!place) return { error: "Kein Ort. Standort erlauben oder Ort als Parameter eintragen." };
  const key = `wx-${place.latitude.toFixed(2)}-${place.longitude.toFixed(2)}.json`;
  try {
    const req = new Request(forecastUrl(place));
    req.timeoutInterval = 15;
    const raw = await req.loadJSON();
    if (!raw || !raw.current) throw new Error(raw && raw.reason ? raw.reason : "Keine Daten");
    writeCache(key, { raw, place, fetchedAt: Date.now() });
    return { data: normalize(raw, place), stale: false };
  } catch (e) {
    const cached = readCache(key);
    if (cached) {
      const data = normalize(cached.raw, cached.place);
      data.fetchedAt = cached.fetchedAt;
      return { data, stale: true };
    }
    return { error: "Keine Verbindung zu Open-Meteo." };
  }
}

// ---------------------------------------------------------------------------
// Auswertung (wie die Jetzt-Karte)
// ---------------------------------------------------------------------------

function clock(data, ts) {
  const d = data.local(ts);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function hourLabel(data, ts) {
  return `${pad(data.local(ts).getUTCHours())} Uhr`;
}

function weekday(data, day, index) {
  if (index === 0) return "Heute";
  return WEEKDAYS[new Date(`${day.date}T12:00:00Z`).getUTCDay()];
}

function upcomingHours(data, count) {
  const now = Date.now();
  return data.hours.filter((h) => h.ts > now).slice(0, count);
}

function hourNow(data) {
  const now = Date.now();
  return data.hours.find((h) => h.ts + 3600e3 > now) || data.hours[0];
}

function upcomingMinutes(data) {
  const now = Date.now();
  return data.minutes.filter((p) => p.ts + 15 * 60e3 > now);
}

/** Rain now / onset, from the 15-minute nowcast and the hourly model. */
function rain(data) {
  const minutes = upcomingMinutes(data);
  const hNow = hourNow(data);
  const wet = (p) => p.mm >= 0.1;
  const rainingNow = data.current.precip >= 0.1 || (minutes[0] && wet(minutes[0])) || (hNow && hNow.mm >= 0.4);
  if (rainingNow) {
    const dry = minutes.slice(1, 9).find((p) => !wet(p));
    return {
      wet: true,
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
    short: onset ? `Regen ab ${clock(data, onset)}` : "Trocken",
    headline: "trocken",
    detail: onset ? `Niederschlag ab ${clock(data, onset)}` : "nächste 12 Std.",
  };
}

function insight(data) {
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
    if (later.temp - now.temp >= 3) out.push("es wird milder");
    else if (now.temp - later.temp >= 3) out.push("es kühlt ab");
  }
  if (out.length) return out.slice(0, 2).join(" · ");
  return `${wmo(data.current.code, data.current.isDay).label} bleibt vorerst ähnlich`;
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function font(size, weight) {
  switch (weight) {
    case "heavy":
      return Font.heavySystemFont(size);
    case "bold":
      return Font.boldSystemFont(size);
    case "semibold":
      return Font.semiboldSystemFont(size);
    case "medium":
      return Font.mediumSystemFont(size);
    case "light":
      return Font.lightSystemFont(size);
    default:
      return Font.systemFont(size);
  }
}

function text(stack, value, size, color, opts = {}) {
  const t = stack.addText(String(value == null ? "" : value));
  t.font = font(size, opts.weight);
  t.textColor = color;
  t.lineLimit = opts.lines || 1;
  t.minimumScaleFactor = opts.scale || 0.75;
  if (opts.shadow !== false) {
    t.shadowColor = new Color("#000000", 0.14);
    t.shadowRadius = 1;
    t.shadowOffset = new Point(0, 1);
  }
  if (opts.align === "center") t.centerAlignText();
  if (opts.align === "right") t.rightAlignText();
  return t;
}

function hstack(parent, spacing = 0) {
  const s = parent.addStack();
  s.layoutHorizontally();
  s.spacing = spacing;
  return s;
}

function vstack(parent, spacing = 0) {
  const s = parent.addStack();
  s.layoutVertically();
  s.spacing = spacing;
  return s;
}

function icon(stack, code, isDay, size, theme) {
  const { symbol } = wmo(code, isDay);
  const sf = SFSymbol.named(symbol) || SFSymbol.named("cloud.fill");
  sf.applyFont(Font.systemFont(size));
  const img = stack.addImage(sf.image);
  img.imageSize = new Size(size, size);
  img.tintColor = symbol.startsWith("sun") ? theme.sun : theme.text;
  return img;
}

function sfIcon(stack, name, size, color) {
  const sf = SFSymbol.named(name);
  sf.applyFont(Font.mediumSystemFont(size));
  const img = stack.addImage(sf.image);
  img.imageSize = new Size(size, size);
  img.tintColor = color;
  return img;
}

function placeLine(parent, data, theme, size) {
  const row = hstack(parent, 3);
  row.centerAlignContent();
  text(row, data.place.name, size, theme.text, { weight: "semibold" });
  if (data.place.gps) sfIcon(row, "location.fill", size - 4, theme.text);
  return row;
}

function hiLo(data) {
  const today = data.days[0];
  return today ? `H ${temp(today.max)}  T ${temp(today.min)}` : "";
}

const TEMP_STOPS = [
  [-15, [94, 92, 230]],
  [-5, [10, 132, 255]],
  [3, [100, 210, 255]],
  [10, [48, 209, 88]],
  [17, [255, 214, 10]],
  [24, [255, 159, 10]],
  [31, [255, 69, 58]],
];

function tempColor(t) {
  if (t <= TEMP_STOPS[0][0]) return new Color(rgb(TEMP_STOPS[0][1]));
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [t1, c1] = TEMP_STOPS[i];
    const [t0, c0] = TEMP_STOPS[i - 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return new Color(rgb(c0.map((v, k) => v + (c1[k] - v) * f)));
    }
  }
  return new Color(rgb(TEMP_STOPS[TEMP_STOPS.length - 1][1]));
}

function rgb(c) {
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Min–max bar like the 10-day list in the app, with the current temperature as a dot. */
function tempBar(day, lo, hi, width, height, theme, current) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const span = Math.max(1, hi - lo);
  const r = height / 2;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, width, height), r, r);
  ctx.addPath(track);
  ctx.setFillColor(theme.faint);
  ctx.fillPath();
  const x0 = ((day.min - lo) / span) * width;
  const x1 = Math.max(x0 + height, ((day.max - lo) / span) * width);
  const steps = Math.max(1, Math.round((x1 - x0) / 2));
  for (let i = 0; i < steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const w = (x1 - x0) / steps + 0.5;
    const t = day.min + ((day.max - day.min) * i) / steps;
    const p = new Path();
    const edge = i === 0 || i === steps - 1;
    if (edge) p.addRoundedRect(new Rect(x, 0, Math.max(w, height), height), r, r);
    else p.addRect(new Rect(x, 0, w, height));
    ctx.addPath(p);
    ctx.setFillColor(tempColor(t));
    ctx.fillPath();
  }
  if (theme.outline) {
    // Warm bars would vanish on the sunny background.
    const edge = new Path();
    edge.addRoundedRect(new Rect(x0, 0, x1 - x0, height), r, r);
    ctx.addPath(edge);
    ctx.setStrokeColor(theme.outline);
    ctx.setLineWidth(1);
    ctx.strokePath();
  }
  if (current != null) {
    const cx = Math.min(width - r, Math.max(r, ((current - lo) / span) * width));
    ctx.setFillColor(new Color("#ffffff"));
    ctx.setStrokeColor(new Color("#000000", 0.35));
    ctx.setLineWidth(1);
    const dot = new Rect(cx - r - 1, -1, height + 2, height + 2);
    ctx.fillEllipse(dot);
    ctx.strokeEllipse(dot);
  }
  return ctx.getImage();
}

/** 2-hour rain bars from the 15-minute nowcast. */
function rainChart(data, width, height, theme) {
  const pts = upcomingMinutes(data).slice(0, 8);
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const max = Math.max(1, ...pts.map((p) => p.mm));
  const gap = 4;
  const bw = (width - gap * (pts.length - 1)) / Math.max(1, pts.length);
  pts.forEach((p, i) => {
    const h = Math.max(3, (p.mm / max) * height);
    const path = new Path();
    path.addRoundedRect(new Rect(i * (bw + gap), height - h, bw, h), 2, 2);
    ctx.addPath(path);
    ctx.setFillColor(p.mm >= 0.1 ? new Color("#64d2ff") : theme.faint);
    ctx.fillPath();
  });
  return ctx.getImage();
}

function hourStrip(parent, data, theme, count, opts = {}) {
  const row = hstack(parent, 0);
  const items = [{ label: "Jetzt", temp: data.current.temp, code: data.current.code, isDay: data.current.isDay }];
  for (const h of upcomingHours(data, count - 1)) {
    items.push({ label: hourLabel(data, h.ts), temp: h.temp, code: h.code, isDay: h.isDay, prob: h.prob });
  }
  items.forEach((it, i) => {
    if (i > 0) row.addSpacer();
    const col = vstack(row, opts.spacing || 5);
    col.centerAlignContent();
    text(col, it.label, opts.labelSize || 11, theme.muted, { weight: "medium", align: "center" });
    icon(col, it.code, it.isDay, opts.iconSize || 18, theme);
    text(col, temp(it.temp), opts.tempSize || 14, theme.text, { weight: "semibold", align: "center" });
  });
  return row;
}

function dayRows(parent, data, theme, count, width, rowSpacing) {
  const days = data.days.slice(0, count);
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const list = vstack(parent, rowSpacing);
  days.forEach((d, i) => {
    const row = hstack(list, 6);
    row.centerAlignContent();
    const name = hstack(row, 0);
    name.size = new Size(42, 0);
    text(name, weekday(data, d, i), 13, theme.text, { weight: "semibold" });
    name.addSpacer();
    const ic = hstack(row, 0);
    ic.size = new Size(22, 0);
    icon(ic, d.code, true, 17, theme);
    const pr = hstack(row, 0);
    pr.size = new Size(32, 0);
    if (d.prob != null && d.prob >= 20) text(pr, `${Math.round(d.prob)}%`, 11, theme.prob, { weight: "semibold" });
    pr.addSpacer();
    const mn = hstack(row, 0);
    mn.size = new Size(30, 0);
    mn.addSpacer();
    text(mn, temp(d.min), 13, theme.muted, { weight: "medium" });
    const barWidth = Math.max(40, width - 42 - 22 - 32 - 30 - 30 - 6 * 5);
    const bar = row.addImage(tempBar(d, lo, hi, barWidth, 5, theme, i === 0 ? data.current.temp : null));
    bar.imageSize = new Size(barWidth, 5);
    const mx = hstack(row, 0);
    mx.size = new Size(30, 0);
    mx.addSpacer();
    text(mx, temp(d.max), 13, theme.text, { weight: "semibold" });
  });
  return list;
}

function cell(parent, theme, sf, label, value, detail, width) {
  const c = vstack(parent, 1);
  if (width) c.size = new Size(width, 0);
  const head = hstack(c, 3);
  head.centerAlignContent();
  sfIcon(head, sf, 10, theme.muted);
  text(head, label.toUpperCase(), 9, theme.muted, { weight: "semibold" });
  text(c, value, 14, theme.text, { weight: "semibold" });
  if (detail) text(c, detail, 10, theme.muted);
  return c;
}

function nowCells(parent, data, theme, width) {
  const r = rain(data);
  const row = hstack(parent, 8);
  const w = width ? Math.floor((width - 16) / 3) : 0;
  cell(row, theme, "umbrella.fill", "Regen", r.headline, r.detail, w);
  const dir = COMPASS[Math.round((data.current.windDir || 0) / 22.5) % 16];
  cell(row, theme, "wind", "Wind", wind(data.current.wind), `aus ${dir} · Böen ${wind(data.current.gusts)}`, w);
  const today = data.days[0];
  if (today && today.sunrise && today.sunset) {
    const up = Date.now() < today.sunset;
    cell(
      row,
      theme,
      up ? "sunset.fill" : "sunrise.fill",
      "Sonne",
      up ? clock(data, today.sunset) : clock(data, (data.days[1] || today).sunrise),
      `${clock(data, today.sunrise)} – ${clock(data, today.sunset)}`,
      w
    );
  }
  return row;
}

function statusLine(data, stale) {
  if (stale) return `Offline · Stand ${clock(data, data.fetchedAt)}`;
  return `Aktualisiert ${clock(data, data.fetchedAt)}`;
}

function heroHeader(parent, data, theme, opts) {
  const cur = data.current;
  const info = wmo(cur.code, cur.isDay);
  const top = hstack(parent, 8);
  const left = vstack(top, 0);
  placeLine(left, data, theme, opts.placeSize || 15);
  text(left, temp(cur.temp), opts.tempSize || 44, theme.text, { weight: "bold", scale: 0.6 });
  top.addSpacer();
  const right = vstack(top, 2);
  const iconRow = hstack(right, 0);
  iconRow.addSpacer();
  icon(iconRow, cur.code, cur.isDay, opts.iconSize || 30, theme);
  right.addSpacer(4);
  const l1 = hstack(right, 0);
  l1.addSpacer();
  text(l1, info.label, 13, theme.text, { weight: "medium", align: "right" });
  const l2 = hstack(right, 0);
  l2.addSpacer();
  if (opts.compact) {
    text(l2, `Gefühlt ${temp(cur.feels)} · ${hiLo(data)}`, 11, theme.muted, { align: "right" });
  } else {
    text(l2, `Gefühlt ${temp(cur.feels)}`, 11, theme.muted, { align: "right" });
    const l3 = hstack(right, 0);
    l3.addSpacer();
    text(l3, hiLo(data), 11, theme.muted, { weight: "medium", align: "right" });
  }
  return top;
}

// ---------------------------------------------------------------------------
// Grössen
// ---------------------------------------------------------------------------

function small(w, data, theme) {
  const cur = data.current;
  const top = hstack(w, 4);
  top.centerAlignContent();
  const place = vstack(top, 0);
  placeLine(place, data, theme, 14);
  top.addSpacer();
  icon(top, cur.code, cur.isDay, 24, theme);
  text(w, temp(cur.temp), 46, theme.text, { weight: "bold", scale: 0.6 });
  w.addSpacer();
  text(w, wmo(cur.code, cur.isDay).label, 12, theme.text, { weight: "semibold", lines: 1 });
  text(w, hiLo(data), 11, theme.muted, { weight: "medium" });
  const r = rain(data);
  const rr = hstack(w, 3);
  rr.centerAlignContent();
  sfIcon(rr, r.wet ? "umbrella.fill" : "drop", 9, r.wet ? theme.prob : theme.muted);
  text(rr, r.short, 10, theme.muted, { weight: "medium" });
}

function medium(w, data, theme) {
  heroHeader(w, data, theme, { tempSize: 40, iconSize: 26, placeSize: 14, compact: true });
  w.addSpacer();
  hourStrip(w, data, theme, 6, { iconSize: 16, tempSize: 13, labelSize: 10, spacing: 4 });
}

function large(w, data, theme) {
  heroHeader(w, data, theme, { tempSize: 44, iconSize: 30, compact: true });
  w.addSpacer(6);
  text(w, insight(data), 13, theme.text, { weight: "medium", lines: 1 });
  w.addSpacer(8);
  nowCells(w, data, theme, 310);
  w.addSpacer(8);
  hourStrip(w, data, theme, 6, { iconSize: 17, tempSize: 13, labelSize: 10, spacing: 3 });
  w.addSpacer(8);
  dayRows(w, data, theme, 5, 310, 2);
  w.addSpacer();
}

function extraLarge(w, data, theme) {
  const row = hstack(w, 22);
  const left = vstack(row, 0);
  left.size = new Size(330, 0);
  heroHeader(left, data, theme, { tempSize: 52, iconSize: 36, placeSize: 16 });
  left.addSpacer(6);
  text(left, insight(data), 13, theme.text, { weight: "medium", lines: 2 });
  left.addSpacer(10);
  nowCells(left, data, theme, 330);
  left.addSpacer();
  hourStrip(left, data, theme, 7, { iconSize: 18, tempSize: 14, labelSize: 10, spacing: 5 });
  const right = vstack(row, 0);
  const head = hstack(right, 4);
  head.centerAlignContent();
  sfIcon(head, "calendar", 10, theme.muted);
  text(head, "7 TAGE", 10, theme.muted, { weight: "semibold" });
  right.addSpacer(6);
  dayRows(right, data, theme, 7, 300, 6);
  right.addSpacer();
  const rh = hstack(right, 4);
  rh.centerAlignContent();
  sfIcon(rh, "umbrella.fill", 10, theme.muted);
  text(rh, `REGEN NÄCHSTE 2 STD. · ${rain(data).short.toUpperCase()}`, 9, theme.muted, { weight: "semibold" });
  right.addSpacer(4);
  const chart = right.addImage(rainChart(data, 300, 30, theme));
  chart.imageSize = new Size(300, 30);
  row.addSpacer();
}

// Sperrbildschirm: iOS färbt selbst ein, deshalb nur Weiss.

function accessoryCircular(w, data) {
  const white = new Color("#ffffff");
  const theme = { text: white, sun: white };
  w.addSpacer();
  const top = hstack(w, 0);
  top.addSpacer();
  icon(top, data.current.code, data.current.isDay, 16, theme);
  top.addSpacer();
  const mid = hstack(w, 0);
  mid.addSpacer();
  text(mid, temp(data.current.temp), 18, white, { weight: "semibold", shadow: false });
  mid.addSpacer();
  const today = data.days[0];
  if (today) {
    const bottom = hstack(w, 0);
    bottom.addSpacer();
    text(bottom, `${Math.round(today.min)}–${Math.round(today.max)}`, 9, white, { weight: "medium", shadow: false });
    bottom.addSpacer();
  }
  w.addSpacer();
}

function accessoryRectangular(w, data) {
  const white = new Color("#ffffff");
  const theme = { text: white, sun: white };
  const cur = data.current;
  const top = hstack(w, 4);
  top.centerAlignContent();
  icon(top, cur.code, cur.isDay, 14, theme);
  text(top, `${temp(cur.temp)} ${data.place.name}`, 14, white, { weight: "semibold", shadow: false });
  text(w, wmo(cur.code, cur.isDay).label, 12, white, { shadow: false });
  text(w, `${hiLo(data)} · ${rain(data).short}`, 12, white, { shadow: false });
}

function accessoryInline(w, data) {
  const cur = data.current;
  const sf = SFSymbol.named(wmo(cur.code, cur.isDay).symbol);
  if (sf) w.addImage(sf.image);
  w.addText(`${temp(cur.temp)} ${data.place.name} · ${rain(data).short}`);
}

// ---------------------------------------------------------------------------
// Zusammensetzen
// ---------------------------------------------------------------------------

async function build(family) {
  const result = await loadWeather();
  const w = new ListWidget();
  w.url = CONFIG.appUrl;
  // iOS entscheidet selbst; gewünscht ist etwa alle 15 Minuten.
  w.refreshAfterDate = new Date(Date.now() + 15 * 60e3);
  const accessory = family.startsWith("accessory");

  if (result.error) {
    const theme = themeFor("cloud");
    if (!accessory) {
      w.backgroundGradient = theme.gradient;
      w.setPadding(14, 14, 14, 14);
    }
    sfIcon(w, "cloud.fill", 22, theme.text);
    w.addSpacer(6);
    text(w, "Wetter CH", 14, theme.text, { weight: "semibold" });
    text(w, result.error, 11, theme.muted, { lines: 4 });
    return w;
  }

  const data = result.data;
  if (family === "accessoryCircular") accessoryCircular(w, data);
  else if (family === "accessoryRectangular") accessoryRectangular(w, data);
  else if (family === "accessoryInline") accessoryInline(w, data);
  else {
    const theme = themeFor(sceneOf(data.current.code, data.current.isDay));
    w.backgroundGradient = theme.gradient;
    const p = family === "small" ? 14 : family === "extraLarge" ? 18 : 15;
    w.setPadding(p, p, p, p);
    if (family === "small") small(w, data, theme);
    else if (family === "large") large(w, data, theme);
    else if (family === "extraLarge") extraLarge(w, data, theme);
    else medium(w, data, theme);
    if (result.stale && family !== "small") {
      w.addSpacer(4);
      text(w, statusLine(data, true), 9, theme.muted);
    }
  }
  return w;
}

if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(await build(config.widgetFamily || "medium"));
} else {
  const alert = new Alert();
  alert.title = "Wetter CH";
  alert.message =
    "Vorschau wählen. Zum Hinzufügen: Home- oder Sperrbildschirm lange drücken › Bearbeiten › Widget hinzufügen › Scriptable, dann dieses Skript wählen.";
  const sizes = [
    ["Klein", "small"],
    ["Mittel", "medium"],
    ["Gross", "large"],
    ["Extragross (iPad)", "extraLarge"],
  ];
  for (const [label] of sizes) alert.addAction(label);
  alert.addCancelAction("Fertig");
  const choice = await alert.presentSheet();
  if (choice >= 0) {
    const family = sizes[choice][1];
    const w = await build(family);
    if (family === "small") await w.presentSmall();
    else if (family === "large") await w.presentLarge();
    else if (family === "extraLarge") await w.presentExtraLarge();
    else await w.presentMedium();
  }
}
Script.complete();
