# Crash Circuit

Arcade-Racer — Konzept: `CONCEPT.md`, Stack: `TECH.md`.

## License

**Project source and original assets** are under the
[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)
(`LICENSE`). That means you may use, study, modify, and share them for
**non-commercial** purposes only — **not** for commercial use of the source or
of modified / derived versions, without a separate permission from the
copyright holders.

Why PolyForm NC: it is a clear, SPDX-listed license written for **software**
(not only media), with an explicit non-commercial purpose limit that covers
distribution of modified copies. See `NOTICE` for what is covered (`src/`,
`levels/`, original Tripo/art) vs third-party material.

**Third-party dependencies** (three.js, Vite, TypeScript, …) keep **their**
licenses — typically MIT / Apache-2.0. The free OSS stack in `TECH.md` is about
*dependencies*, not a grant to commercialize Crash Circuit itself.

Third-party assets listed in `public/models/*/SOURCES.md` (e.g. CC0 Kenney)
remain under those terms; we do not re-license them as proprietary.

## Start (ohne vorinstalliertes Node)

| OS | Befehl |
|----|--------|
| Linux / macOS | `./start.sh` |
| Windows (cmd) | `start.bat` |
| Windows (PowerShell) | `.\start.ps1` |

Die Skripte:

1. Nutzen vorhandenes **Node.js ≥ 20**, falls vorhanden  
2. Sonst laden sie einmalig eine **portable Node-Version** nach `.tools/` (Internet nötig)  
3. Führen bei Bedarf `npm install` aus und starten den Dev-Server auf **allen Interfaces** (`0.0.0.0:5173`)

**Unix-Fallback-Downloader:** `curl`, sonst `wget`, sonst `python3` (+ `tar` zum Entpacken).  
**Windows:** eingebautes PowerShell (`start.bat` startet es fest aus `System32`). Portable Node bringt `npm.cmd` mit — ein vorinstalliertes npm ist nicht nötig.

### Vom Haupt-PC (Hyper-V-Host)

1. In der VM: `./start.sh` (oder `npm run dev`) — IP wird ausgegeben  
2. Am Host-PC im Browser: `http://<VM-IP>:5173/` (aktuell oft `http://172.26.98.19:5173/`)  
3. Falls blockiert: in der **VM-Firewall** Port **5173/tcp** erlauben; Hyper-V-Switch muss die VM erreichbar machen (Default Switch / External)

## Develop

```bash
npm test          # unit
npm run test:e2e  # Playwright: starts server + browser smoke
npm run free:dev  # free :5173 safely (never pkill -f vite — kills agent shells)
npm run test:all
npm run build
```

### Dev-Cheats (Tastatur)

| Taste | Aktion |
|-------|--------|
| **F1** | Debug-Namen ein/aus (`data-dev-name` Labels auf UI-Elementen) |
| **F2** | CHF setzen (Textfeld → Übernehmen) |
| **F3** | Aktuelles Rennen beenden + Platz 1–n wählen |

## MVP (v0.2.x)

- Cup, Freier Modus, Garage, CHF, KI-Rennen, Tastatur/Gamepad/Touch

## Delivery

Jeder Schritt: Version → Commit auf `master` → Push. Keine Feature-Branches.  
Startskripte müssen **immer funktionieren** und Node möglichst selbst bootstrappen.
