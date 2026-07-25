# Crash Circuit

Arcade-Racer — Konzept: `CONCEPT.md`, Stack: `TECH.md`.

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
**Windows:** eingebaute PowerShell-Befehle.

### Vom Haupt-PC (Hyper-V-Host)

1. In der VM: `./start.sh` (oder `npm run dev`) — IP wird ausgegeben  
2. Am Host-PC im Browser: `http://<VM-IP>:5173/` (aktuell oft `http://172.26.98.19:5173/`)  
3. Falls blockiert: in der **VM-Firewall** Port **5173/tcp** erlauben; Hyper-V-Switch muss die VM erreichbar machen (Default Switch / External)

## Develop

```bash
npm test
npm run build
```

## MVP (v0.2.x)

- Cup, Freier Modus, Garage, CHF, KI-Rennen, Tastatur/Gamepad/Touch

## Delivery

Jeder Schritt: Version → Commit auf `master` → Push. Keine Feature-Branches.  
Startskripte müssen **immer funktionieren** und Node möglichst selbst bootstrappen.
