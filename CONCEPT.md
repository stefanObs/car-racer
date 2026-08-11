# Crash Circuit — Spielkonzept

**Arbeitstitel:** Crash Circuit  
**Genre:** Arcade-Racer mit Tuning & Garage  
**Zielgruppe:** Jungen ab ca. 10 Jahren  
**Sprache:** Deutsch  
**Plattform:** Browser — **Desktop** (Tastatur), **Controller/Gamepad** und **Tablet** (Touch) sind gleichwertig spielbar (kein Desktop-only-MVP)

**Tech (locked):** TypeScript + Vite + three.js + HTML-UI — siehe [`TECH.md`](TECH.md).  
**Delivery:** Jeder Implementationsschritt wird **versioniert**, auf **`master` committed** und **gepusht** — **keine Feature-Branches**.

---

## 1. Pitch (eine Zeile)

Du baust in der Garage dein Auto so, dass die Teile **zusammenpassen**, und fährst damit möglichst schnelle Rennen gegen KI — Kontakt und Chaos machen die Duelle spannender, entscheiden sie aber nicht allein.

---

## 2. Fantasie & Ton

- **Fantasie:** Tuner-Garage + Asphaltpiste. Nicht realistisch-simuliert, sondern knackig, lesbar, belohnend.
- **Ton:** Cool, frech, nicht kindisch. Humor über Ansagen, Fahrzeugnamen und Fahr-Feedback — keine Gewalt-Fantasie über Menschen.
- **Visuell (locked):** **Asphalt-Comic** — Cel-Shading, dicke Outlines, flache knallige Farben, klare Silhouetten; lesbare Schaden-/Heil-Effekte. Cartoon-hart, **nicht fotorealistisch** (keine PBR-/Foto-Materialien).  
  Skill: `.cursor/skills/asphalt-comic-art/` · Referenz: `.cursor/skills/asphalt-comic-art/reference.png`
- **Fahrzeug-Look:** Silhouette, Proportionen und Typ-Merkmale sollen **nah an echten Autos der jeweiligen Klasse** liegen (z. B. Sportwagen ≈ moderne Coupé/GT-Form; Pick-up ≈ echte Pickup-Box und Kabine). Ziel: sofort erkennbare Kategorie, aber **im Engine-Look renderbar** (klare Volumen, wenige Hauptflächen, dicke Outlines — kein Detail-Wirrwarr). Zielblatt: `assets/art-style/car-category-targets.png`.

**USP:**  
**Kern:** getunte Autos möglichst schnell über die Linie bringen.  
**Nebeneffekt:** Rammen und Kontakt machen Rennen lebendig. Schaden heilt mit der Zeit. Tuning ist Puzzle aus Vor- und Nachteilen. Gras, Unebenheiten und Mauern bestrafen unsaubere Linien — gute Federung mildert das.

---

## 3. Kernschleife

```
Garage / Menü
    → Modus wählen: Cup / Freier Modus / Ad-hoc-Strecke
        → Rennen (3–5 Runden, ca. 2–4 Min)
            → Platzierung + Style-Boni → CHF
        → Ergebnis-Screen
    → Garage: Auto schmücken / kaufen / teilen
    → nächstes Rennen / nächste Klasse
```

Kurz, wiederholbar, klar belohnend. Ein Lauf soll sich in einer Sitzung von **7–15 Minuten** „erfolgreich“ anfühlen — typisch durch **Freischalten** (nächste Cup-Strecke) oder **Kauf** eines spürbaren Garage-Upgrades (Teil).

---

## 4. Rennmechanik

### 4.1 Was ist Kern — was ist Würze

| Rolle | Mechanik |
|-------|----------|
| **Kernfantasie** | Linie halten, Tempo aufbauen, Build ausspielen, möglichst schnell fahren |
| **Würze** | Kontakt/Rammen, leichte Schubserei in engen Stellen, Chaos wenn jemand ausbricht |

Es gibt **keine eigene Rammtaste**. Kontakt entsteht aus Physik (enge Kurven, Überholen, Fehler). Wer nur rammt und schlecht fährt, verliert gegen saubere Tempo-Fahrer.

### 4.2 Steuerung (Arcade) — Tastatur, Controller, Tablet

Gleiche Aktionen auf allen Eingabegeräten; kein Feature nur auf einer Plattform.

| Aktion | Tastatur | Controller | Tablet (Touch) |
|--------|----------|------------|----------------|
| Gas / Bremse | Tasten | Trigger (RT/LT o. ä.) | Virtuelle Pedale / rechter Stick-Zone |
| Lenken | Pfeile / A–D | Linker Stick (oder D-Pad) | Virtuelles Lenkrad / linker Stick-Zone |
| Nitro | Taste | Face-Button / Bumper | Nitro-Button (Daumen-Erreichbarkeit) |
| Menü / Bestätigen / Zurück | Enter / Esc | A / B (Layout-Hints) | Tap / Zurück-Chrome |

**Pflichten:**

- **Controller:** vollständige Menü- und Rennsteuerung; Plug-and-play; UI-Fokus sichtbar; keine Mauspflicht.
- **Tablet:** Touch-Steuerung im Rennen + alle Menüs/Garage bedienbar; große Hit-Targets; HUD und kritische Infos ohne Hover; Landscape-first, nutzbar in typischen Tablet-Auflösungen; kein „nur mit Tastatur“-Schritt.
- Eingabe jederzeit wechselbar (z. B. Controller anschließen mid-session), wo die Plattform das erlaubt.

Kein realistisches Drift-Physik-Sim — eher **Gewicht + Grip + Impuls** mit Arcade-Fahrgefühl: Lenkung wird bei Tempo ruhiger, Grip lässt das Auto in Kurven leicht rutschen statt panzerartig zu drehen, Gas baut Tempo knackig auf, Loslassen lässt es **ausrollen** (nicht abrupt stoppen).

### 4.3 Physik-Säulen (fürs Balancing)

Jedes Auto hat (Basis + Teile):

1. **Beschleunigung** — wie schnell Tempo aufgebaut wird  
2. **Höchstgeschwindigkeit** — Cap  
3. **Grip / Schleuderresistenz** — wie stark das Auto bei Kurven/Treffern ausbricht  
4. **Masse / Schubkraft** — wer wen bei Kontakt verschiebt  
5. **Panzerung** — wie viel Schaden ein Treffer / Aufprall macht  
6. **Handling-Präzision** — Lenkansprechen bei niedrigem Schaden  
7. **Federung** — dämpft Unebenheiten, mildert Gras-Malus, stabilisiert Landungen  

**Design-Regel:** Es gibt kein reines „bestes Auto“. Starke Stats erzeugen immer Gegenkosten — außer durch **gute Teile-Kombos** (siehe Kap. 6.4).

### 4.4 Streckenaufbau: Asphalt → Gras → Mauer

Querschnitt der Piste (von innen nach außen):

```
[ Asphalt (volle Speed) ]
[ Gras (Geschwindigkeitsmalus) ]
[ Mauer: Reifen in Kurven / Beton auf Geraden ]
```

| Zone | Effekt | Federung |
|------|--------|----------|
| **Asphalt** | Normale Stats | — |
| **Gras** | Deutlich langsamer, etwas schwammigeres Handling | Gute Federung **reduziert** den Malus merklich, **entfernt ihn nicht** |
| **Mauer** | Harter Aufprall, **mäßiger** Schaden, **Abprall** zurück auf die Bahn (kein Dauer-Schaden-Spam) | Federung mildert Bounce etwas; Schaden bleibt relevant |

**Mauer-Varianten:**

- **Kurven:** Reifenstapel / Reifenwand — etwas nachgiebiger (Bounce, mittlerer Schaden).
- **Geraden / sonst:** Betonmauer — härter (stärkerer Speed-Kill, mehr Schaden).

So belohnt saubere Linienführung; Abkürzen über Gras ist möglich, aber teuer — außer mit starker Federung etwas erträglicher.

**Layout-Regeln (lesbar für ~10+):**

1. **Klarer Fahrkorridor** — Mitte der Bahn ist der Weg; Hindernisse stehen am Rand oder sind eindeutig als Blocker markiert.
2. **Keine Streckenkreuzung ohne Brücke** — Die Mittellinie darf sich nicht selbst kreuzen. Braucht ein Layout eine Überquerung, dann **Brücke** (oben befahrbar) plus **Mauer**, die den unteren Streckenteil absperrt. MVP-Cups/Ad-hoc: einfache Ovale ohne Kreuzung.
3. **Passierbare Props** nur wenn klar erkennbar **und** flach genug zum Darüberfahren (z. B. gelbe Rüttelstreifen, Öl-Pfütze). Hohe Props (Betonsperre, Reifenstapel) sind **nicht** passierbar und kollidieren.
4. **Bahn nicht verlassen** — Außenmauer hält Autos in Asphalt+Gras; Abprall verhindert Durchqueren der Mauer.

### 4.5 Rammen & Schaden (Nebeneffekt)

**Kontakt / Rammen**

- Entsteht natürlich bei Überholen, engen Stellen und Fehlern.
- Frontal / seitlich / Heck: relative Geschwindigkeit und Masse entscheiden Schub und Schaden.
- Der leichtere / fragilere Wagen wird stärker verschoben und nimmt mehr Schaden.
- Saubere, knappe Überholmanöver können etwas Style-Geld geben — nicht „Rampunkte“ als Hauptscore.

**Schadenszustände** (Spieler + KI sichtbar)

| Stufe | Name | Effekt |
|------|------|--------|
| 0 | Tip-top | Normal |
| 1 | Beulen | Leicht schlechteres Lenken, etwas mehr Schleudern |
| 2 | ramponiert | Deutlich weniger Grip, Boost schwächer, Rauch |
| 3 | kritisch | Lenkung träge, Max-Speed runter, Funken |
| 4 | **K.O.** | Kurze Auszeit, dann Comeback unbeschädigt |

**Schaden regeneriert sich über Zeit**

- Solange man nicht weiter getroffen wird / nicht in die Mauer knallt, tickt Schaden **stufenweise zurück** (z. B. kritisch → ramponiert → Beulen → tip-top).
- **Sichtbarer Heil-Effekt:** z. B. kurze Reparaturfunken, aufblitzendes Werkzeug-Icon, abklingender Rauch, „Karosserie zieht sich zusammen“-Animation — klar lesbar für Kids.
- Erneuter Treffer unterbricht / setzt Heilung zurück.
- So bleibt Schaden spürbar, aber kein Dauer-Debuff für den Rest des Rennens.

**Respawn nach K.O.**

- Nach ~3–5 Sekunden kehrt das Auto **unbeschädigt** zurück.
- Positionsnachteil bleibt (hinten / Rand, kleiner Speed-Nachteil).
- K.O. ist selten das Ziel — eher Konsequenz von Kettenfehlern oder hartem Mauer-Kontakt bei schon kritischem Zustand.

### 4.6 Hindernisse auf der Strecke

Hindernisse ergänzen Tempo-Fahren; sie sind lesbar und build-relevant:

| Typ | Wirkung | Lesbarkeit | Federung |
|-----|---------|------------|----------|
| **Unebene Piste** (Segment) | Wagen „hüpft“ / wackelt, Tempo stockt | Wellen / Buckel auf der Bahn | **Gute Federung dämpft stark** |
| **Rüttelstreifen** (`uneven` Prop) | Passierbar, flach, klar gestreift; Tempo stockt | Gelb/schwarz Zebra | Federung dämpft |
| **Ölspur** | Passierbar, flach; Grip weg | Dunkle Pfütze + Schimmer | Kaum Hilfe |
| **Reifenstapel** | Bounce + leichter Schaden — **nicht** passierbar | Orange/schwarz, hoch | Leicht |
| **Betonsperren** | Harter Bounce — **nicht** passierbar | Grau + gelber Streifen, hoch | Kaum |
| Rollende Fässer | Bewegliche Gefahr | Metallglanz | — |
| Sprungschanzen | Luftzeit; Landung braucht Grip | Rampe | Federung stabilisiert Landung |

KI nutzt Layout: bremst vor Buckeln, drängt dich bei Fehlern Richtung Gras/Mauer.

### 4.7 Catch-up (Spannung ohne Zwangssieg der KI)

Autos **weiter hinten** bekommen einen **leichten, transparenten Catch-up**:

- etwas **stärkere Beschleunigung**
- **minimal höhere** Höchstgeschwindigkeit

**Wichtig:** Das ist ein Nachzieh-Boost, kein Rubber-Band-Magnet.

- Fährt der Spieler **sauber und fehlerfrei**, kann und soll er der KI **davonfahren**.
- Catch-up hält packende Duelle und Comebacks möglich, wenn vorne jemand in Gras/Mauer/Unebenheit pecht.
- Kein unsichtbares „KI klebt ewig am Heck“, wenn der Spieler klar besser ist.

### 4.8 Rennziel & Wertung

- **Primär:** Platzierung (1–6 oder 1–8).
- **Sekundär (Bonus in CHF):**
  - Saubere Überholmanöver / knappe Near Misses an Mauern
  - Führungsrunden / saubere Sektoren
  - Drift-Style leicht dosiert
  - Optional kleiner Bonus für Kontakt-Abwehr ohne selbst zu eskalieren
- **Malus:** wiederholte eigene K.O.s (kleiner Abzug), absichtliches Stehenbleiben (Anti-Exploit).

Preisgeld-Formel (Skizze):

```
CHF = Basis(Platz) + StyleBoni − Malus
Basis: 1. = hoch, ab 4. noch „Trostrunde“, damit Fortschritt nie tot ist
```

**Sitzungs-Pacing (verbindlich):** In **7–15 Minuten** soll ein neuer Spieler etwas Sinnvolles freischalten oder kaufen können.

| Ziel | Richtwert |
|------|-----------|
| Erfolgreiche Kurz-Sitzung | 7–15 min |
| Frühe Cup-Rennen | eher **2 Runden** (kurz, wiederholbar) |
| Starter-Teil (spürbar) | nach **≤ 2** Intro-Rennen auch mit **Mittelfeld (Platz 4)** finanzierbar |
| Solides frühes Teil | mit **Platz 1** im ersten Intro-Rennen kaufbar |
| 2. Auto (Bison) | eher Ende der 7–15-min-Spanne / etwas darüber bei gutem Fahren — kein Sofort-Kauf |

Kosmetik (Lack/Aufkleber) bleibt schnell erreichbar und **ohne Stats**; „sinnvoll“ meint vor allem **Teile** oder **Cup-Freischaltung**.

---

## 5. Fahrzeugklassen (Gear-Typen)

Statt endloser Einzelautos: **Klassen** mit klarem Fantasy- und Stats-Profil. Pro Klasse ca. **10 Strecken/Levels** (siehe Kap. 8).

### 5.1 Vorgeschlagene Klassen (Startroster)

| Klasse | Fantasy | Stärken | Schwächen |
|--------|---------|---------|-----------|
| **Sportwagen** („Blitz“) | Flink, teuer, showy | Top-Beschleunigung, hohe Max-Speed, präzise Lenkung bei 0 Schaden | Leicht, wenig Panzerung, wird bei Kontakt weit weggeschoben, nimmt viel Schaden |
| **Pick-up / Muscle** („Bison“) | Schwer, cool, standfest | Masse, Panzerung, stabiler bei Kontakt | Langsamere Beschleunigung, träger in engen Kurven |
| **Buggy** („Käferkraft“) | Verspielt, geländetauglich | Sehr guter Grip, starke Federung (Gras/Unebenheit) | Mittlere Speed, mittlere Masse |
| **Hot Rod** („Donnerbüchse“) | Laut, Nitro-lastig | Starker Boost, gute Geradeaus-Speed | Schlechter Grip, „schleudert gern“ |
| **Panzerwagen** (Mid/Late Unlock) („Bunker“) | Fast unzerstörbar | Extrem panzerig, unerschütterlich | Sehr langsam, schlechtes Handling — braucht Teile-Kombo zum Leben |

**Frühes Unlock-Beispiel:** Sportwagen + Pick-up frei → Buggy → Hot Rod → Panzerwagen.

**Art-Regel (Klassen):** Jede Klasse strebt eine **kategorie-treue** Comic-Form an — so nah an realen Fahrzeugen dieser Kategorie, dass ein 10-Jähriger sofort „Sportwagen“ vs. „Pick-up“ vs. „Buggy“ erkennt. Formen müssen mit dem Asphalt-Comic-Mesh-Stil **machbar** bleiben (siehe Zielblatt `assets/art-style/car-category-targets.png`).

Spieler kann mehrere Autos besitzen; aktives Auto wählen in der Garage.

**Teile / Lack / Aufkleber sind pro Auto gespeichert** — Kauf und Einbau an einem Fahrzeug gelten nicht automatisch für andere Klassen/Autos. Wer den Bison kauft, startet ohne die Blitz-Teile und muss (oder darf) neu tunen.

### 5.2 Feinschliff

- **Sportwagen:** schnell rein in Tempo, aber empfindlich — Ideal für saubere Linien und Timing.
- **Pick-ups:** langsamer auf Tempo, aber halten Druck und Kontakt besser aus.
- **Buggy:** Liebling auf unebenen / grasnahen Strecken dank Federung.
- **Gute Kombi-Fantasie:** Sportwagen + große Räder + Federung + Spoiler = schnell *und* ruhig — teuer, lohnt sich.

---

## 6. Garage: CHF, Schmuck, Kauf, Tuning

### 6.1 Währung

- **CHF (Franken)** — aus Rennen. Anzeige z. B. `CHF 1'250` oder `Fr. 1'250`.
- Optional später: **Sterne / Ruf** für Freischaltungen (nicht kaufbar), damit nicht alles nur Grind ist.

### 6.2 Drei Ausgaben-Säulen

1. **Schmücken (Kosmetik)** — Lack, **Aufkleber** (Flammen, Blitze, Sterne, Emblem…; **Bunker:** Tür-Badge „IronClad“ austauschbar), Felgen-Look, Spoiler-Optik, Unterbodenlicht, Nummernschild-Text, Horn-Sound. **Käferkraft:** statt Flach-Aufkleber **Nasen-/Kopf-Modellvarianten** (Glatt, Totenkopf inkl. Hörner, Vogel, Hund); die vorderen **Scheinwerfer** gehören zum Auto (nicht zur Nasen-Kosmetik). **Kein Stats-Vorteil** (fair, sammelbar, stolz zeigen).
2. **Neues Auto kaufen** — andere Klasse oder Variante innerhalb der Klasse.
3. **Teile tunen** — echte Stats, immer mit Trade-off.

**Aufkleber-Details:** Texturen auf Lack (Seite / Motorhaube / Tür je nach Auto); Sets freischaltbar über Cups oder CHF.

### 6.3 Teile (Beispiele, alle mit Vor- & Nachteil)

| Teil | Vorteil | Nachteil |
|------|---------|----------|
| **Großer Motor** | Mehr Beschleunigung & etwas Max-Speed | Mehr Schleudern / hecklastig, höherer Boost-Verbrauch |
| **Große Räder** | Weniger Schleudern, stabilere Landungen | Etwas weniger Höchstgeschwindigkeit |
| **Spike-Stoßstange** | Mehr Schub / Schaden bei Kontakt | Handling etwas „hakelig“, mehr eigener Schaden bei Frontalcrash in Mauer |
| **Bessere Bremsen** | Schärferes Verzögern, engere Linien | Leicht schlechtere Beschleunigung aus Kurven |
| **Verstärkter Rahmen** | Weniger Schaden, härterer Stand | Trägere Lenkung, etwas weniger Top-Speed |
| **Leichtbau-Karosserie** | Bessere Beschleunigung & Lenkung | Viel mehr Schaden, leichter wegdrückbar |
| **Nitro-Kit** | Längerer / stärkerer Boost | Bei Schaden gefährlicher (Boost + Beulen = Spin) |
| **Gelände-Federung** | Dämpft Unebenheiten stark; reduziert Gras-Malus (nicht auf null); bessere Landungen | Etwas schwammiger bei reiner Asphalt-Präzision |
| **Heckspoiler (Performance)** | Grip bei hoher Speed | Weniger absichtliches Schleudern |
| **Gewichtsplatten** | Stabiler bei Kontakt, mehr Masse | Beschleunigung und Lenkung leiden |

**Design-Regel für jedes Teil:**  
Kind muss in **einem Satz** Vor- und Nachteil verstehen. UI zeigt immer beides + kurze Empfehlung („Gut mit großen Rädern“).

### 6.4 Synergie-System („gute Kombinationen“)

Nicht nur additive Stats — **Synergie-Tags**:

Beispiele:

- `Motor++` + `Große Räder` + `Heckspoiler` → **„Straßenkleber“**: Schleuder-Malus des Motors stark reduziert, Speed-Malus der Räder teilweise aufgehoben.
- `Federung` + `Große Räder` + `Buggy` → **„Buckelkönig“**: Unebenheiten und Gras kaum noch Drama.
- `Rahmen` + `Gewicht` + Pick-up → **„Fels in der Brandung“**: stabil bei Kontakt, weniger Selbstschaden.
- `Leichtbau` + `Nitro` + `Bremsen` → **„Blitzattacke“**: extremes Tempo — Panzerung bleibt kritisch.

**UI:** Bei 2–3 passenden Teilen leuchtet ein Kombo-Name auf. Tuning = Builds sammeln, nicht nur Zahlen maximieren.

Schlechte Combos dürfen existieren (lauter Motor + Leichtbau ohne Grip = „Schleuderplatte“) — lehrreich und witzig.

---

## 7. Progression & Meta

### 7.1 Freischaltung

- Neue **Strecken** durch Platzierung (z. B. Top 3) oder Sterne.
- Neue **Klassen** durch Karriere-Meilensteine („5 Siege mit Pick-up“).
- Neue **Teile-Stufen** (I / II / III) und Aufkleber-Sets.

### 7.2 Schwierigkeit der KI

Pro Gegner sichtbare Persönlichkeit (kurz, lesbar):

| KI-Typ | Verhalten |
|--------|-----------|
| **Fair-Play Felix** | Fährt Linie, sucht selten Kontakt |
| **Drängler Dana** | Enges Überholen, riskiert Kontakt als Nebeneffekt |
| **Drifter Dino** | Riskant in Kurven, fehleranfällig |
| **Blocker Ben** | Verteidigt Führung mit Schlangenlinien |
| **Opportunist Olli** | Nutzt deine Fehler (Gras, Wackler) |

Kids lesen Gegner und passen Taktik an — Fokus bleibt Tempo und Linie.

### 7.3 Catch-up & Skill-Ceiling

- Catch-up aktiv für hinten liegende Fahrzeuge (Spieler und KI gleichermaßen, fair).
- Skill-Ceiling: fehlerfreies Fahren + guter Build > KI-Nachziehhilfe.
- Balancing-Ziel: „knapp Zweiter nach Fehler“ fühlt sich packend an; „sauber Erster“ fühlt sich verdient an.

### 7.4 Assistenz (Accessibility für 10+)

- Optional: Lenkhilfe, Absolvieren-Bremse vor engen Kurven, klarere Damage-/Heil-Farben.
- Hilfen, die Können aufbauen — kein Default-Unbesiegbar-Modus.
- Touch: etwas großzügigere Lenk-Deadzone optional; Controller: stick sensitivity einstellbar.

---

## 8. Strecken, Cups, Freier Modus, Ad-hoc

**Level-Autorenschaft:** Skill `.cursor/skills/level-editor/` (Spec: `track-spec.md`, Beispiellevel unter `levels/`).

### 8.1 Cup-Struktur (~10 Level pro Klasse)

Pro Fahrzeugklasse eine **eigene Cup-Serie** mit ~10 Rennen:

1. Einführungsstrecke (wenig Hindernisse, lernt Klasse)
2.–4. Standard-Variationen (Stadt, Küste, Industrie)
5. Breite Tempo-Strecke (Überholen üben, erste Unebenheiten)
6.–7. Hindernis-fokussiert (Öl, Buckelpiste, Sprünge)
8. Nacht / Regen (Grip runter — Teile-Check)
9. Boss-Strecke (stärkere KI + Layout-Trick)
10. Cup-Finale (längere Runde, gemischte Gegnerklassen)

**Gesamt:** ~40–50 handgemachte Cup-Rennen über alle Klassen; Themes und Layout-Bausteine wiederverwenden.

### 8.2 Strecken-Themes (Beispiele)

- Hafen-Asphalt mit Containern  
- Canyon mit Leitplanken-Lücken  
- Stadtring mit Baustellen / Buckelpflaster  
- Schrottplatz-Ring  
- Bergpass mit Haarnadeln  
- Strandpiste (mehr Gras-Risiko)  
- Fabrik mit unebenen Platten  

Jedes Theme: Asphalt/Gras/Mauer-Regel + 1–2 Signatur-Hindernisse.

### 8.3 Freier Modus

- Beliebige **freigeschaltete** Strecke wählen.
- Gegneranzahl, KI-Stärke, Rundenanzahl einstellbar.
- Eigenes Auto / Build aus der Garage.
- Belohnung in CHF etwas geringer als im Cup (Cup bleibt Karriere-Hauptpfad) — oder gleich, aber ohne Sterne-Fortschritt.
- Ideal zum Testen neuer Teile-Kombos und zum „nur mal ballern“.

### 8.4 Ad-hoc generierte Strecken

- **Schnellrennen / Zufallsstrecke:** Generator baut aus Bausteinen eine fahrbare Runde.
- Parameter (Beispiele): Länge, Kurvigkeit, Anteil Unebenheit, Gras-Breite, Theme-Skin.
- Immer gültige Regeln: Asphalt → Gras → Mauer (Reifen in Kurven, Beton sonst); Start/Ziel; sinnvolle KI-Wege.
- Seed anzeigbar („Strecke #A7F2“) zum Teilen / Wiederholen.
- Optional: tägliche Challenge-Seed mit fixer Belohnung.

**Technisch:** Piecewise-Track aus Segmenten (Gerade, Kurve L/R, S-Kurve, Buckelfeld, Engstelle) + Theme-Overlay — nicht endlos-prozedural-Chaos, sondern kontrollierte Variation.

### 8.5 Weitere optionale Modi

- **Zeitjagd:** Uhr + Geisterfahrzeug — Feintuning-Tests.
- **Pokal-Wochenende:** Drei Rennen, Gesamtwertung.

*(Kein separater „nur Rammen“-Hauptmodus — passt nicht zur Kernfantasie.)*

---

## 9. UX / Screens (Spielerfluss)

1. **Garage (Start-Hub)** — Auto per **Mausziehen / Touch** frei drehen, **ausrüsten**, Lack/Aufkleber; **Eigenschaften-Popup** rechts oben mit Level-Balken (1–100) für Beschleunigung, Tempo, Grip, Handling, Federung, Panzerung, Gewicht, Nitro; von hier Cup / Freier Modus / Ad-hoc starten  
2. **Cup-Karte** — Streckenknoten, Sterne, empfohlene Klasse  
3. **Freier Modus / Ad-hoc** — Strecke oder Seed, Optionen, Start  
4. **Renn-HUD** — Platz, **Runden-Zähler** (aktuell / gesamt), Mini-Map, Schaden (inkl. Heil-Hinweis), Nitro, Style-Popups (`+50 CHF`); **Warnung „Falsche Richtung!“** bei anhaltender Gegenfahrt  
5. **Ergebnis** — Zielbanner/-linie; Ziel-Animation (Podest vs. Feld); Podium-Landung; CHF; weiter / Garage  
6. **Hilfe** — Steuerungshinweise (optional)  

Sprache durchgängig Deutsch; kurze Sätze; Icons + Text.

**Eingabe-UX:** alle Screens und die Garage müssen mit **Controller** (Fokus-Navigation) und **Tablet-Touch** vollständig bedienbar sein — nicht nur das Rennen.

---

## 10. Pädagogik des Designs (warum das für 10+ funktioniert)

- **Sofort-Spaß:** Tempo, Boost, knackiges Handling, sichtbares Tuning.  
- **Würze ohne Fokusverlust:** Kontakt macht Chaos, entscheidet aber nicht die Fantasy.  
- **Tiefe ohne Excel:** Trade-offs und Kombos belohnen Nachdenken.  
- **Schaden mit Comeback:** Heilt über Zeit + Effekt; K.O. selten und fair.  
- **Stolz:** Aufkleber + benannte Builds = Identität.  
- **Fairness:** Kosmetik powerfrei; Catch-up hält Spannung, Skill darf davonfahren.  
- **Viel Content:** Cups + Freier Modus + Ad-hoc-Strecken.

---

## 11. Scope-Empfehlung (Umsetzung)

**QA / Review:** Skill `.cursor/skills/review-testing/` — Spielbarkeit (10+), UX, Asphalt-Comic-Konsistenz, Regression über alle Level.

### MVP (Spielspaß zuerst)

- 2 Klassen (Sportwagen, Pick-up)  
- 1 Cup à 8–10 Strecken (oder 5 + Varianten)  
- Asphalt / Gras / Mauer (Reifen vs Beton)  
- Unebenheiten + Federung-Effekt  
- Kontakt-Schaden mit **Zeitheilung + Effekt**, K.O.-Respawn  
- Leichter Catch-up hinten, Skill-Ceiling für fehlerfreies Fahren  
- 6–8 Teile inkl. Federung + 2–3 Synergien  
- Garage: 2. Auto, Lack, Aufkleber-Basis, **CHF**  
- Freier Modus auf freigeschalteten Strecken  
- Deutsche UI  
- **Controller-Support** (Rennen + Menüs)  
- **Tablet-Touch** (Rennen + Menüs, Landscape)  

### Danach

- Weitere Klassen/Themes, Teile II/III, mehr Aufkleber-Sets, Zeitjagd  

**Geliefert nach MVP-Kern:** Ad-hoc-Generator (Seed, Länge, Theme, CHF ohne Sterne).

---

## 12. Tech-Stack & offene Design-Entscheidungen

**Lizenz-Regel:** Nur **kostenlos nutzbare** Technik (bevorzugt permissive OSS). Keine bezahlten Engines / keine runtime-Pflicht-SaaS. Details: [`TECH.md`](TECH.md).

### Empfohlener Stack (primär) — **übernommen**

| Schicht | Wahl |
|---------|------|
| Sprache / Build | **TypeScript** + **Vite** |
| 3D | **three.js** (MIT), Chase-Kamera flach/erhöht |
| Physik | Zuerst **eigene Arcade-Vehicle-Logik**; bei Bedarf **Rapier** (Apache-2.0) |
| UI | **HTML/CSS-Overlay** (Menüs, Garage, HUD) — ideal für Tablet + Controller-Fokus |
| Input | Eine ActionMap → Tastatur + **Gamepad API** + **Touch** |
| Tests | **Vitest** + **Playwright** |
| Speichern MVP | **localStorage** |
| Hosting (optional) | GitHub Pages / Cloudflare Pages (kostenlos) |

**Alternative (ebenfalls gratis):** **Godot 4** (MIT) — stark bei Input/Editor; Web-Export möglich, Garage-UI aufwendiger als HTML.

**Explizit nicht:** Unity/Unreal als Abhängigkeit (Lizenz-/Kostenmodell passt nicht zur Free-only-Regel).

### Noch offen (Game-Design-Zahlen)

- Exakte Catch-up-Kurven (wie viel Extra-Accel/Speed pro Platz-Abstand)  
- Heilgeschwindigkeit Schaden (Sekunden pro Stufe)  
- Ob Teile mitten im Cup gewechselt werden dürfen (ja — fördert Experimente)  
- Ad-hoc: rein lokal generieren vs. Seed-Sharing  
- Speichern nur lokal vs. Cloud  

---

## 13. Zusammenfassung (aktuell)

| Thema | Stand |
|-------|--------|
| Kerndynamik | Getunte Autos möglichst schnell fahren |
| Rammen | Nebeneffekt / Würze, keine Rammtaste, kein Rampunkte-Fokus |
| Schaden | Regeneriert über Zeit mit sichtbarem Heil-Effekt; K.O. mit Comeback |
| Unebene Piste | Hüpf-/Wackleffekt; Federung dämpft |
| Gras | Langsamer; Federung mildert, entfernt nicht |
| Rand | Gras → Mauer (Reifen in Kurven, Beton sonst); **kein Self-Cross** ohne Brücke; klare Passierbarkeit |
| Catch-up | Hinten: bessere Beschleunigung + minimal mehr Speed; fehlerfreier Spieler fährt davon |
| Währung | **CHF** |
| Sitzungs-Pacing | **7–15 min** → Freischalten oder sinnvolles Garage-Upgrade |
| Schmücken | Lack + **Aufkleber** — **pro Auto**; Teile ebenfalls **nicht** zwischen Autos geteilt |
| Fahrzeug-Art | Kategorie-treue Silhouetten (nah an echten Klassen-Autos), Asphalt-Comic, engine-renderbar |
| Modi | Cup + **Freier Modus** + **Ad-hoc-generierte Strecken** |
| Eingabe / Plattform | **Tastatur + Controller + Tablet (Touch)** — gleichwertig spielbar |
| Tech (Empfehlung) | **TS + Vite + three.js + HTML-UI** übernommen; nur Free/OSS — siehe `TECH.md` |
| Delivery | Jeder Schritt: Version → Commit auf `master` → Push; **keine Branches** |

---

*Dokumentstand: Konzept v3.19 — Käferkraft-Mesh + Nasen (Totenkopf/Vogel/Hund) aus Tripo-Konzepten, Asphalt-Comic.*
