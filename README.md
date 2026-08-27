# tesla-deck

Minimal Tesla in-car browser app. Dark UI aligned with Tesla software. Altitude is the main readout.

Repo: https://github.com/amplituhedronx/tesla-deck

## Deploy on Render (same as your other apps)

Use a **Static Site**, not a Web Service. This file has no server. Static sites stay up (no 15-minute spin-down) and stay on HTTPS, which the Tesla browser needs.

### Option A — Blueprint

1. Open [Render Dashboard](https://dashboard.render.com/)
2. **New → Blueprint**
3. Select `amplituhedronx/tesla-deck`
4. Apply. You get `https://tesla-deck.onrender.com` (or a unique suffix)

### Option B — Manual

1. **New → Static Site**
2. Connect `amplituhedronx/tesla-deck`, branch `main`
3. Build command: leave empty
4. Publish directory: `.`
5. Create Static Site

Then open the `*.onrender.com` URL in the Tesla browser, allow location, bookmark it.

If location was denied: Controls → Service → Clear Browser Data, reload.

## What it shows

- Large GPS altitude (smoothed), m / ft
- Terrain elevation from Open-Meteo (MSL)
- Vertical speed and session min–max
- Lat, lon, speed, heading
- Four shortcut tiles (Edit → label + HTTPS URL)

## Local

Open `index.html` in a desktop browser. Geolocation needs HTTPS or localhost.
