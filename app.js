const $ = (id) => document.getElementById(id);
const state = {
  unit: localStorage.getItem("deck-unit") || "m",
  watchId: null,
  pollId: null,
  lastPos: null,
  lastAlt: null,
  lastAltTs: 0,
  smoothAlt: null,
  vs: 0,
  vsReady: false,
  minAlt: null,
  maxAlt: null,
  lastElevFetch: 0,
  lastElevAt: null,
  terrain: null,
  editMode: false,
  editIndex: -1,
  starting: false,
  shortcuts: loadShortcuts()
};

function loadShortcuts() {
  try {
    const raw = JSON.parse(localStorage.getItem("deck-shortcuts") || "[]");
    if (Array.isArray(raw) && raw.length) return raw.slice(0, 4);
  } catch (_) {}
  return [null, null, null, null];
}
function saveShortcuts() {
  localStorage.setItem("deck-shortcuts", JSON.stringify(state.shortcuts));
}

function setUnit(u) {
  state.unit = u;
  localStorage.setItem("deck-unit", u);
  $("btnM").classList.toggle("on", u === "m");
  $("btnFt").classList.toggle("on", u === "ft");
  $("altUnit").textContent = u;
  if (state.lastPos) render(state.lastPos);
}

function fmtAlt(m) {
  if (m == null || Number.isNaN(m)) return "\u2014";
  const v = state.unit === "ft" ? m * 3.28084 : m;
  return Math.round(v).toString();
}
function fmtAlt1(m) {
  if (m == null || Number.isNaN(m)) return "\u2014";
  const v = state.unit === "ft" ? m * 3.28084 : m;
  return (Math.round(v * 10) / 10).toFixed(1);
}
function fmtCoord(n, digits) {
  if (n == null) return "\u2014";
  return n.toFixed(digits);
}
function fmtSpeed(mps) {
  if (mps == null || Number.isNaN(mps)) return "\u2014";
  if (state.unit === "ft") {
    const mph = mps * 2.23694;
    return `${Math.round(mph)}<span class="u"> mph</span>`;
  }
  const kmh = mps * 3.6;
  return `${Math.round(kmh)}<span class="u"> km/h</span>`;
}
function fmtHdg(h) {
  if (h == null || Number.isNaN(h)) return "\u2014";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  const i = Math.round(h / 45) % 8;
  return `${Math.round(h)}\u00b0 <span class="u">${dirs[i]}</span>`;
}
function fmtVs(mps) {
  if (!state.vsReady || mps == null || Number.isNaN(mps)) return "0 " + state.unit + "/min";
  const v = Math.round(mps * 60 * (state.unit === "ft" ? 3.28084 : 1));
  return (v > 0 ? "+" : "") + v + " " + state.unit + "/min";
}

function setStatus(kind, text) {
  const dot = $("dot");
  dot.className = "dot " + kind;
  $("statusText").textContent = text;
}

function distM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function updateClimb(alt, speed) {
  const now = Date.now();
  state.vsReady = true;

  if (speed != null && speed < 0.5) {
    state.vs *= 0.4;
    if (Math.abs(state.vs) < 0.03) state.vs = 0;
    state.lastAlt = alt;
    state.lastAltTs = now;
    return;
  }

  if (state.lastAlt == null || !state.lastAltTs) {
    state.vs = 0;
    state.lastAlt = alt;
    state.lastAltTs = now;
    return;
  }

  const dt = (now - state.lastAltTs) / 1000;
  if (dt < 0.2) return;

  const inst = (alt - state.lastAlt) / dt;
  if (!Number.isFinite(inst)) return;
  state.vs = state.vs * 0.75 + inst * 0.25;
  if (Math.abs(state.vs) < 0.02) state.vs = 0;
  state.lastAlt = alt;
  state.lastAltTs = now;
}

async function fetchTerrain(lat, lon) {
  const now = Date.now();
  if (now - state.lastElevFetch < 20000) return;
  if (state.lastElevAt && distM(state.lastElevAt, { lat, lon }) < 40) return;
  state.lastElevFetch = now;
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("elev");
    const data = await res.json();
    const el = Array.isArray(data.elevation) ? data.elevation[0] : data.elevation;
    if (typeof el === "number") {
      state.terrain = el;
      state.lastElevAt = { lat, lon };
      $("terrainAlt").textContent = fmtAlt1(el) + " " + state.unit;
    }
  } catch (_) {}
}

function render(pos) {
  const c = pos.coords;
  const gpsAlt = c.altitude;
  if (gpsAlt != null && Number.isFinite(gpsAlt)) {
    if (state.smoothAlt == null) state.smoothAlt = gpsAlt;
    else state.smoothAlt = state.smoothAlt * 0.72 + gpsAlt * 0.28;
    if (state.minAlt == null || gpsAlt < state.minAlt) state.minAlt = gpsAlt;
    if (state.maxAlt == null || gpsAlt > state.maxAlt) state.maxAlt = gpsAlt;
    updateClimb(gpsAlt, c.speed);
  }

  $("alt").textContent = fmtAlt(state.smoothAlt);
  $("gpsAlt").textContent = fmtAlt1(gpsAlt) + " " + state.unit;
  $("terrainAlt").textContent = state.terrain == null ? "\u2014" : fmtAlt1(state.terrain) + " " + state.unit;
  $("vs").textContent = fmtVs(state.vs);
  if (state.minAlt != null) {
    $("session").textContent = fmtAlt(state.minAlt) + " \u2013 " + fmtAlt(state.maxAlt);
  }
  $("lat").textContent = fmtCoord(c.latitude, 5);
  $("lon").textContent = fmtCoord(c.longitude, 5);
  $("spd").innerHTML = fmtSpeed(c.speed);
  $("hdg").innerHTML = fmtHdg(c.heading);

  const acc = c.accuracy;
  if (acc != null && acc <= 12) setStatus("live", "GPS lock");
  else if (acc != null && acc <= 40) setStatus("live", "GPS \u00b1" + Math.round(acc) + " m");
  else if (acc != null) setStatus("wait", "GPS \u00b1" + Math.round(acc) + " m");
  else setStatus("live", "GPS live");

  if (c.latitude != null) fetchTerrain(c.latitude, c.longitude);
}

const isTesla = /Tesla/i.test(navigator.userAgent);
const isAppleTouch =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function showGate(title, text) {
  $("gateTitle").textContent = title;
  $("gateText").textContent = text;
  $("gate").classList.add("show");
}

function onError(err) {
  const code = err && err.code;
  if (code === 1) {
    setStatus("off", "Location blocked");
    showGate(
      "Safari blocked location",
      isAppleTouch
        ? "Open Settings → Safari → Location → Ask or Allow. Or tap aA in the address bar → Website Settings → Location. Then reload this page and tap Enable location."
        : "This site is blocked from using location. Allow it in the browser site settings, then tap Enable location."
    );
  } else if (code === 2) {
    setStatus("wait", "GPS unavailable");
    showGate("No GPS fix", "Location is allowed, but the phone has no fix yet. Go outside or toggle Location Services off and on, then tap Enable location again.");
  } else if (code === 3) {
    setStatus("wait", "GPS timeout");
  } else {
    setStatus("wait", err && err.message ? err.message : "GPS error");
  }
}

function startWatch() {
  if (state.starting) return;
  state.starting = true;
  setTimeout(() => { state.starting = false; }, 1500);
  if (!window.isSecureContext) {
    setStatus("off", "Needs HTTPS");
    showGate("Needs HTTPS", "Open the Render URL (https), not a local file.");
    return;
  }
  if (!navigator.geolocation) {
    setStatus("off", "No geolocation");
    showGate("No geolocation", "This browser does not expose GPS.");
    return;
  }
  if (state.watchId != null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  $("gate").classList.remove("show");
  setStatus("wait", "Acquiring GPS");
  const opts = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.lastPos = pos;
      render(pos);
    },
    onError,
    opts
  );
  state.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      state.lastPos = pos;
      render(pos);
    },
    onError,
    opts
  );
  if (state.pollId) clearInterval(state.pollId);
  state.pollId = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lastPos = pos;
        render(pos);
      },
      () => {
        if (state.lastAlt != null) updateClimb(state.lastAlt, 0);
        if (state.lastPos) $("vs").textContent = fmtVs(state.vs);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  }, 1000);
}

function renderShortcuts() {
  const row = $("shortcutRow");
  row.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const item = state.shortcuts[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot" + (item && item.url ? "" : " empty");
    if (state.editMode) {
      btn.textContent = item && item.label ? item.label : "Empty";
    } else if (item && item.url) {
      btn.textContent = item.label || "Open";
    } else {
      btn.textContent = "+";
    }
    btn.addEventListener("click", () => {
      if (state.editMode || !item || !item.url) openEditor(i);
      else window.location.href = item.url;
    });
    row.appendChild(btn);
  }
  $("editShortcuts").textContent = state.editMode ? "Done" : "Edit";
}

function openEditor(i) {
  state.editIndex = i;
  const item = state.shortcuts[i] || {};
  $("modalTitle").textContent = "Shortcut " + (i + 1);
  $("scLabel").value = item.label || "";
  $("scUrl").value = item.url || "";
  $("modal").classList.add("show");
}

function closeEditor() {
  $("modal").classList.remove("show");
  state.editIndex = -1;
}

$("btnM").addEventListener("click", () => setUnit("m"));
$("btnFt").addEventListener("click", () => setUnit("ft"));
$("askLoc").addEventListener("click", (e) => {
  e.preventDefault();
  startWatch();
});
$("editShortcuts").addEventListener("click", () => {
  state.editMode = !state.editMode;
  renderShortcuts();
});
$("scCancel").addEventListener("click", closeEditor);
$("scDelete").addEventListener("click", () => {
  if (state.editIndex >= 0) {
    state.shortcuts[state.editIndex] = null;
    saveShortcuts();
    renderShortcuts();
  }
  closeEditor();
});
$("scSave").addEventListener("click", () => {
  let url = $("scUrl").value.trim();
  const label = $("scLabel").value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  if (state.editIndex >= 0) {
    state.shortcuts[state.editIndex] = url ? { label: label || "Link", url } : null;
    saveShortcuts();
    renderShortcuts();
  }
  closeEditor();
});

setUnit(state.unit);
renderShortcuts();

if (isTesla) {
  startWatch();
} else {
  setStatus("wait", "Tap to enable GPS");
  showGate(
    "Enable location",
    isAppleTouch
      ? "On iPhone, Safari only asks for GPS after a tap. Tap the button, then Allow."
      : "Tap to allow GPS. The browser will prompt once."
  );
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && isTesla) startWatch();
});
