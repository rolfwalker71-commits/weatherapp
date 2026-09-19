// @ts-nocheck (runs in Scriptable, not in the app; stripped on export)
// Wetter CH — Widgets für Scriptable (https://scriptable.app)
// Erzeugt in der App unter Einstellungen › Scriptable-Widgets.
// Daten: Open-Meteo (wie die App), kein Konto und kein Schlüssel nötig.
//
// Widget-Parameter (optional, lange auf das Widget drücken › Widget bearbeiten),
// mehrere durch Komma getrennt, z. B. «karte, Zürich»:
//   karte | klassisch  – Stil des Widgets
//   gps                – immer den aktuellen Standort zeigen
//   Zürich             – einen anderen Ort zeigen (Ortsname)
//
// Antippen öffnet die animierte Detailansicht direkt in Scriptable.

const CONFIG = "__CONFIG__";
const GLYPHS = "__GLYPHS__";

//__CORE__

const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.cacheDirectory(), "wetter-ch-widget");
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);

const windText = (kmh) => wind(kmh, CONFIG.wind);

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
    glass: new Color("#ffffff", light ? 0.3 : 0.16),
    glyph: new Color(scene === "night" ? "#f3f1ff" : "#ffffff"),
  };
}

// ---------------------------------------------------------------------------
// Parameter und Ort
// ---------------------------------------------------------------------------

function parseParam(raw) {
  const out = { raw: String(raw || "").trim(), style: null, gps: false, place: null };
  for (const token of out.raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
    const l = token.toLowerCase();
    if (l === "karte" || l === "jetzt") out.style = "card";
    else if (l === "klassisch" || l === "kompakt") out.style = "classic";
    else if (l === "gps" || l === "standort") out.gps = true;
    else out.place = token;
  }
  return out;
}

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
    const place = { name: "Aktueller Standort", latitude: loc.latitude, longitude: loc.longitude, gps: true };
    try {
      const geo = await Location.reverseGeocode(loc.latitude, loc.longitude, "de");
      const g = geo && geo[0];
      if (g) {
        place.name = g.locality || g.subLocality || g.subAdministrativeArea || place.name;
        place.admin1 = g.administrativeArea;
        place.country = g.country;
      }
    } catch (e) {}
    writeCache("gps.json", place);
    return place;
  } catch (e) {
    // Widgets bekommen nicht immer einen Standort: letzten bekannten nehmen.
    return readCache("gps.json") || CONFIG.fallback;
  }
}

async function searchPlace(query) {
  const key = `geo2-${query.toLowerCase().replace(/[^a-z0-9äöüéèà]/g, "_")}.json`;
  const cached = readCache(key);
  if (cached) return cached;
  try {
    const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=de&format=json`;
    const json = await new Request(url).loadJSON();
    const hit = json.results && json.results[0];
    if (!hit) return null;
    const place = { name: hit.name, latitude: hit.latitude, longitude: hit.longitude, admin1: hit.admin1, country: hit.country };
    writeCache(key, place);
    return place;
  } catch (e) {
    return null;
  }
}

async function resolvePlace(param) {
  if (param.gps) return gpsPlace();
  if (param.place) {
    const found = await searchPlace(param.place);
    if (found) return found;
  }
  return CONFIG.place ? CONFIG.place : gpsPlace();
}

async function loadWeather(param) {
  const place = await resolvePlace(param);
  if (!place) return { error: "Kein Ort. Standort erlauben oder Ort als Parameter eintragen." };
  const key = `wx-${place.latitude.toFixed(2)}-${place.longitude.toFixed(2)}.json`;
  try {
    const req = new Request(forecastUrl(place));
    req.timeoutInterval = 15;
    const raw = await req.loadJSON();
    if (!raw || !raw.current) throw new Error(raw && raw.reason ? raw.reason : "Keine Daten");
    const fetchedAt = Date.now();
    writeCache(key, { raw, place, fetchedAt });
    return { data: normalize(raw, place, fetchedAt), stale: false };
  } catch (e) {
    const cached = readCache(key);
    if (cached) return { data: normalize(cached.raw, cached.place, cached.fetchedAt), stale: true };
    return { error: "Keine Verbindung zu Open-Meteo." };
  }
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
    case "thin":
      return Font.thinSystemFont(size);
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

function tempColor(t) {
  return new Color(tempHex(t));
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
    text(name, weekday(d, i), 13, theme.text, { weight: "semibold" });
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
  cell(row, theme, "wind", "Wind", windText(data.current.wind), `aus ${compass(data.current.windDir)} · Böen ${windText(data.current.gusts)}`, w);
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

function classicSmall(w, data, theme) {
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

function classicMedium(w, data, theme) {
  heroHeader(w, data, theme, { tempSize: 40, iconSize: 26, placeSize: 14, compact: true });
  w.addSpacer();
  hourStrip(w, data, theme, 6, { iconSize: 16, tempSize: 13, labelSize: 10, spacing: 4 });
}

function classicLarge(w, data, theme) {
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

function classicExtraLarge(w, data, theme) {
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
// Stil «Jetzt-Karte»: Szene als Hintergrundbild, Aufbau wie die Karte in der App
// ---------------------------------------------------------------------------

/** Widget sizes in points (Apple HIG); the background image is drawn at this size. */
function widgetSize(family) {
  const s = Device.screenSize();
  const w = Math.min(s.width, s.height);
  let t;
  if (Device.isPad()) {
    if (w >= 1024) t = [170, 379, 379, 795];
    else if (w >= 820) t = [155, 342, 342, 715];
    else if (w >= 810) t = [146, 320, 320, 669];
    else t = [141, 305, 305, 634];
  } else if (w >= 428) t = [170, 364, 382];
  else if (w >= 414) t = [169, 360, 379];
  else if (w >= 390) t = [158, 338, 354];
  else if (w >= 375) t = s.height >= 812 ? [155, 329, 345] : [148, 321, 324];
  else t = [141, 292, 311];
  if (family === "small") return [t[0], t[0]];
  if (family === "medium") return [t[1], t[0]];
  if (family === "extraLarge") return [t[3] || t[1] * 2 + 16, t[2]];
  return [t[1], t[2]];
}

function lerpStops(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (t <= t1) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return c0.map((v, k) => v + (c1[k] - v) * f);
    }
  }
  return stops[stops.length - 1][1];
}

function rgba(c, alpha) {
  const hex = `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  return new Color(hex, Math.max(0, Math.min(1, alpha == null ? c[3] : alpha)));
}

/** DrawContext adapter for `paintScene` (gradients as bands and rings). */
function scriptablePainter(ctx) {
  return {
    linear(x, y, w, h, stops) {
      const n = Math.max(2, Math.ceil(h / 2));
      for (let i = 0; i < n; i++) {
        const c = lerpStops(stops, (i + 0.5) / n);
        ctx.setFillColor(rgba(c));
        ctx.fillRect(new Rect(x, y + (h * i) / n, w, h / n + (c[3] >= 1 ? 0.6 : 0)));
      }
    },
    radial(cx, cy, rx, ry, stops) {
      // Rings from outside in; each ring's alpha tops the coverage up to the target.
      const n = 28;
      let covered = 0;
      for (let k = n; k >= 1; k--) {
        const t = k / n;
        const c = lerpStops(stops, t);
        const target = c[3];
        if (target <= covered + 0.002) continue;
        const a = (target - covered) / (1 - covered);
        covered = target;
        ctx.setFillColor(rgba(c, a));
        ctx.fillEllipse(new Rect(cx - rx * t, cy - ry * t, rx * t * 2, ry * t * 2));
      }
    },
    ellipse(cx, cy, rx, ry, c) {
      ctx.setFillColor(rgba(c));
      ctx.fillEllipse(new Rect(cx - rx, cy - ry, rx * 2, ry * 2));
    },
    poly(points, c) {
      const p = new Path();
      p.addLines(points.map(([x, y]) => new Point(x, y)));
      p.closeSubpath();
      ctx.addPath(p);
      ctx.setFillColor(rgba(c));
      ctx.fillPath();
    },
    line(x1, y1, x2, y2, width, c) {
      const p = new Path();
      p.move(new Point(x1, y1));
      p.addLine(new Point(x2, y2));
      ctx.addPath(p);
      ctx.setStrokeColor(rgba(c));
      ctx.setLineWidth(width);
      ctx.strokePath();
    },
  };
}

const CARD = {
  small: { pad: 14, glyph: 34 },
  medium: { pad: 15, glyph: 46 },
  large: { pad: 16, glyph: 60 },
  extraLarge: { pad: 18, glyph: 56 },
};

function cardBackground(w, family, scene) {
  const [W, H] = widgetSize(family);
  const spec = CARD[family];
  const gx = family === "extraLarge" ? spec.pad + 330 - spec.glyph / 2 : W - spec.pad - spec.glyph / 2;
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = true;
  ctx.respectScreenScale = true;
  paintScene(scriptablePainter(ctx), scene, W, H, { x: gx, y: spec.pad + spec.glyph / 2, size: spec.glyph });
  w.backgroundImage = ctx.getImage();
}

function bigGlyph(stack, cur, size, theme) {
  const sf = SFSymbol.named(wmo(cur.code, cur.isDay).symbol) || SFSymbol.named("cloud.fill");
  sf.applyFont(Font.systemFont(size));
  const img = stack.addImage(sf.image);
  img.imageSize = new Size(size, size);
  img.tintColor = theme.glyph;
  return img;
}

function glass(parent, theme, spacing = 6) {
  const s = vstack(parent, spacing);
  s.backgroundColor = theme.glass;
  s.cornerRadius = 14;
  s.setPadding(10, 12, 10, 12);
  return s;
}

function cardTop(parent, data, stale, theme, opts) {
  const top = hstack(parent, 8);
  const left = vstack(top, 1);
  text(left, statusLine(data, stale), opts.statusSize, theme.muted);
  placeLine(left, data, theme, opts.placeSize);
  text(left, placeRegion(data.place), opts.regionSize, theme.muted);
  top.addSpacer();
  bigGlyph(top, data.current, opts.glyph, theme);
  return top;
}

function cardNow(parent, data, theme, tempSize, labelSize) {
  const cur = data.current;
  const row = hstack(parent, 10);
  row.centerAlignContent();
  text(row, temp(cur.temp), tempSize, theme.text, { weight: "thin", scale: 0.6 });
  const side = vstack(row, 1);
  text(side, wmo(cur.code, cur.isDay).label, labelSize, theme.text, { weight: "medium", lines: 2 });
  text(side, `Gefühlt ${temp(cur.feels)}`, labelSize - 4, theme.muted);
  return row;
}

function cardStrip(parent, data, theme, width) {
  const box = glass(parent, theme, 6);
  const r = rain(data);
  const pair = hstack(box, 10);
  const col = Math.floor((width - 24 - 10) / 2);
  const cells = [
    ["umbrella.fill", "Regen", r.headline, r.detail],
    ["wind", "Wind", windText(data.current.wind), `aus ${compass(data.current.windDir)} · Böen ${windText(data.current.gusts)}`],
  ];
  for (const [sf, label, value, detail] of cells) {
    const c = vstack(pair, 1);
    c.size = new Size(col, 0);
    const head = hstack(c, 4);
    head.centerAlignContent();
    sfIcon(head, sf, 11, theme.muted);
    text(head, label, 11, theme.muted);
    text(c, value, 18, theme.text, { weight: "semibold" });
    text(c, detail, 10, theme.muted);
  }
  text(box, metricsLine(data), 10, theme.text, { scale: 0.7 });
  const sun = sunLine(data);
  if (sun) {
    const row = hstack(box, 4);
    row.centerAlignContent();
    sfIcon(row, "sunrise.fill", 10, theme.text);
    text(row, sun, 10, theme.text);
  }
  return box;
}

function cardSmall(w, data, stale, theme) {
  const cur = data.current;
  const top = hstack(w, 4);
  placeLine(vstack(top, 0), data, theme, 15);
  top.addSpacer();
  bigGlyph(top, cur, CARD.small.glyph, theme);
  text(w, temp(cur.temp), 48, theme.text, { weight: "thin", scale: 0.6 });
  w.addSpacer();
  text(w, wmo(cur.code, cur.isDay).label, 13, theme.text, { weight: "medium" });
  text(w, todayRange(data), 11, theme.muted);
}

function cardMedium(w, data, stale, theme) {
  cardTop(w, data, stale, theme, { statusSize: 10, placeSize: 20, regionSize: 11, glyph: CARD.medium.glyph });
  w.addSpacer();
  const row = hstack(w, 8);
  row.bottomAlignContent();
  cardNow(row, data, theme, 48, 15);
  row.addSpacer();
  const right = vstack(row, 2);
  const r = rain(data);
  const rr = hstack(right, 3);
  rr.addSpacer();
  sfIcon(rr, r.wet ? "umbrella.fill" : "drop", 10, r.wet ? theme.prob : theme.muted);
  text(rr, r.short, 11, theme.text, { weight: "medium" });
  const tr = hstack(right, 0);
  tr.addSpacer();
  text(tr, todayRange(data), 11, theme.muted);
}

function cardLarge(w, data, stale, theme) {
  const inner = widgetSize("large")[0] - CARD.large.pad * 2;
  cardTop(w, data, stale, theme, { statusSize: 11, placeSize: 26, regionSize: 12, glyph: CARD.large.glyph });
  w.addSpacer(4);
  cardNow(w, data, theme, 62, 17);
  w.addSpacer(4);
  text(w, insight(data), 14, theme.text, { weight: "medium" });
  const cloth = clothing(data);
  if (cloth) text(w, cloth, 14, theme.text);
  w.addSpacer(8);
  cardStrip(w, data, theme, inner);
  w.addSpacer();
  text(w, todayRange(data), 12, theme.muted);
}

function cardExtraLarge(w, data, stale, theme) {
  const [W] = widgetSize("extraLarge");
  const row = hstack(w, 22);
  const left = vstack(row, 0);
  left.size = new Size(330, 0);
  cardTop(left, data, stale, theme, { statusSize: 11, placeSize: 26, regionSize: 12, glyph: CARD.extraLarge.glyph });
  left.addSpacer(4);
  cardNow(left, data, theme, 58, 17);
  left.addSpacer(4);
  text(left, insight(data), 14, theme.text, { weight: "medium" });
  const cloth = clothing(data);
  if (cloth) text(left, cloth, 14, theme.text);
  left.addSpacer();
  cardStrip(left, data, theme, 330);
  const rightWidth = W - CARD.extraLarge.pad * 2 - 330 - 22;
  const right = vstack(row, 8);
  right.size = new Size(rightWidth, 0);
  const hours = glass(right, theme, 0);
  hourStrip(hours, data, theme, 7, { iconSize: 18, tempSize: 14, labelSize: 10, spacing: 4 });
  const days = glass(right, theme, 4);
  const head = hstack(days, 4);
  head.centerAlignContent();
  sfIcon(head, "calendar", 10, theme.muted);
  text(head, "7 TAGE", 10, theme.muted, { weight: "semibold" });
  dayRows(days, data, theme, 6, rightWidth - 24, 2);
  right.addSpacer();
}

// ---------------------------------------------------------------------------
// Zusammensetzen
// ---------------------------------------------------------------------------

function detailUrl(param) {
  return `scriptable:///run/${encodeURIComponent(Script.name())}?view=detail&p=${encodeURIComponent(param.raw)}`;
}

async function build(family, rawParam) {
  const param = parseParam(rawParam);
  const style = param.style || CONFIG.style || "classic";
  const result = await loadWeather(param);
  const w = new ListWidget();
  // Antippen: Detailansicht in Scriptable (Web-Apps lassen sich per Link nicht öffnen).
  w.url = detailUrl(param);
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
  else if (style === "card") {
    const scene = sceneOf(data.current.code, data.current.isDay);
    const theme = themeFor(scene);
    const p = CARD[family] ? CARD[family].pad : 15;
    w.setPadding(p, p, p, p);
    try {
      cardBackground(w, CARD[family] ? family : "medium", scene);
    } catch (e) {
      w.backgroundGradient = theme.gradient;
    }
    if (family === "small") cardSmall(w, data, result.stale, theme);
    else if (family === "large") cardLarge(w, data, result.stale, theme);
    else if (family === "extraLarge") cardExtraLarge(w, data, result.stale, theme);
    else cardMedium(w, data, result.stale, theme);
  } else {
    const theme = themeFor(sceneOf(data.current.code, data.current.isDay));
    w.backgroundGradient = theme.gradient;
    const p = family === "small" ? 14 : family === "extraLarge" ? 18 : 15;
    w.setPadding(p, p, p, p);
    if (family === "small") classicSmall(w, data, theme);
    else if (family === "large") classicLarge(w, data, theme);
    else if (family === "extraLarge") classicExtraLarge(w, data, theme);
    else classicMedium(w, data, theme);
    if (result.stale && family !== "small") {
      w.addSpacer(4);
      text(w, statusLine(data, true), 9, theme.muted);
    }
  }
  return w;
}

async function showDetail(rawParam) {
  const result = await loadWeather(parseParam(rawParam));
  if (result.error) {
    const a = new Alert();
    a.title = "Wetter CH";
    a.message = result.error;
    a.addCancelAction("OK");
    await a.present();
    return;
  }
  const wv = new WebView();
  // Links (Web-App) in Safari öffnen, nicht in der Detailansicht.
  wv.shouldAllowRequest = (req) => {
    if (/^https?:/.test(req.url)) {
      Safari.open(req.url);
      return false;
    }
    return true;
  };
  await wv.loadHTML(detailHtml(result.data, GLYPHS, { stale: result.stale, wind: CONFIG.wind, appUrl: CONFIG.appUrl }));
  await wv.present(true);
}

async function presentWidget(family, param) {
  const w = await build(family, param);
  if (family === "small") await w.presentSmall();
  else if (family === "large") await w.presentLarge();
  else if (family === "extraLarge") await w.presentExtraLarge();
  else await w.presentMedium();
}

const query = args.queryParameters || {};
if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(await build(config.widgetFamily || "medium", args.widgetParameter));
} else if (query.view === "detail") {
  await showDetail(query.p || "");
} else {
  const alert = new Alert();
  alert.title = "Wetter CH";
  alert.message =
    "Vorschau wählen. Zum Hinzufügen: Home- oder Sperrbildschirm lange drücken › Bearbeiten › Widget hinzufügen › Scriptable, dann dieses Skript wählen.";
  const choices = [["Detailansicht (animiert)", null, null]];
  for (const [style, name] of [["card", "Jetzt-Karte"], ["classic", "Klassisch"]]) {
    for (const [label, family] of [["Klein", "small"], ["Mittel", "medium"], ["Gross", "large"], ["Extragross (iPad)", "extraLarge"]]) {
      choices.push([`${name} · ${label}`, style, family]);
    }
  }
  for (const [label] of choices) alert.addAction(label);
  alert.addCancelAction("Fertig");
  const choice = await alert.presentSheet();
  if (choice === 0) await showDetail("");
  else if (choice > 0) {
    const [, style, family] = choices[choice];
    await presentWidget(family, style === "card" ? "karte" : "klassisch");
  }
}
Script.complete();
