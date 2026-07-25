# Crash Circuit

Arcade-Racer — Konzept: `CONCEPT.md`, Stack: `TECH.md`.

## Start

| OS | Befehl |
|----|--------|
| Linux / macOS | `./start.sh` |
| Windows (cmd) | `start.bat` |
| Windows (PowerShell) | `.\start.ps1` |

Die Skripte prüfen Node.js (≥ 20), installieren bei Bedarf Abhängigkeiten und starten den Dev-Server (meist http://localhost:5173).

Alternativ:

```bash
npm install
npm start
```

## Develop

```bash
npm test
npm run build
```

## MVP (v0.2.x)

- Cup mit 5 Strecken (Sportwagen-Karriere)
- Freier Modus für freigeschaltete Strecken
- Garage: Blitz + Bison, Lack, Aufkleber, Teile, Kombos, CHF
- Arcade-Rennen: Gras/Mauer, Buckel, Schaden+Heilung, K.O., Catch-up, KI
- Eingabe: Tastatur, Gamepad, Touch (Tablet)

## Delivery

Jeder Schritt: Version → Commit auf `master` → Push. Keine Feature-Branches.  
Startskripte müssen laut Projekt-Rule **immer funktionieren**.
