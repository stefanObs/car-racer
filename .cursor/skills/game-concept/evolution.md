# Concept Evolution

## Versioning

Track in the footer of `CONCEPT.md`:

```text
*Dokumentstand: Konzept vN — <one-line focus>.*
```

Bump **N** when invariants, core loop, economy, modes, or art lock change. Typos / clarity-only edits need no bump.

## Decision log

Append newest first.

### 2026-08-17 — Restore Bunker welded tires and original atlas

- Trigger: user — bunker looks destroyed; reset tire and coloring changes
- RCA: UV-carving dark-grey BodyPaint islands into flat Tire prims (v3.61) punched the APC and dropped the Tripo tire albedo. Window recolor (v3.99) and bumper/light paint-skip (v3.100) further scrambled pale atlas islands. Flattening StockWheel_* back onto the body kept the carve.
- Decision: Restock `bunker.glb` from the pre-split Tripo bake (single BodyPaint prim, welded textured tires). Drop `extract-bunker-stock-wheels` and bumper/light paint-skip. Große Räder stays hide-stock + procedural overlays (CONCEPT §6.3). Do not UV-carve Bunker wheels again.

### 2026-08-16 — Donnerbüchse nose after engine gap takes garage paint

- Trigger: user — front panels after the engine-bay gap do not take garage paint; they are not engine
- RCA: The inner nose (`z≥1.22`) was returned to BodyPaint, but washed cyan albedo (RGB `218,237,252` at `(-0.316, 0.987, 1.28)`) fails `isBlueBodyPixel` (`chroma/max < 0.32`). Garage paint skips those texels, so they stay stock-colored while the outer shell recolors. They are not engine.
- Decision: Keep the nose-after-gap band on BodyPaint. Retarget washed/body-blue faces that fail garage-paint chroma onto a canonical body-blue UV. Keep scoop/pulleys and outboard zoomies on StockEngine.
- CONCEPT §6.3 unchanged; `npm run cars:bake-donnerbuechse-segmented-engine`

### 2026-08-16 — Donnerbüchse StockEngine +X cowl / 2/3-blue walls

- Trigger: user — one side mostly fine with a small hole; fix the other side the same way
- RCA: Centroid UV sampling missed faces whose verts are body-blue but the centroid hits an atlas seam (23 leftover on +X vs 8 on −X at y≥0.75). Four dark −X cowl-lip faces at the sample height stayed on `StockEngine` (exact mirrors already on BodyPaint).
- Decision: Return a face if 2/3 verts (or centroid) match body blue, plus the cowl-lip band around `(±0.593, 1.097, 0.284)`. Do not pull outboard zoomies back onto the body.
- CONCEPT §6.3 unchanged; `npm run cars:bake-donnerbuechse-segmented-engine`

### 2026-08-16 — Donnerbüchse StockEngine body-paint blue return

- Trigger: user — sample `(-0.593, 1.097, 0.284)`; everything with that blue belongs on BodyPaint, not the engine
- RCA: Albedo there is RGB `40,111,217` (hue ~216°). AABB grille swap left ~765 same-blue faces on `StockEngine` (bay walls / cowl). Hiding the engine deleted body paint.
- Decision: After remount, return faces whose albedo matches that body blue (including darker AO). Keep chrome header-tail swap. No punch.
- CONCEPT §6.3 unchanged (v3.95); `npm run cars:bake-donnerbuechse-segmented-engine`

### 2026-08-16 — Donnerbüchse StockEngine face swap (grille vs zoomie tails)

- Trigger: user — Großer Motor hides some body blue; a lower exhaust tail stays on the car
- RCA: Tripo's engine prim included ~50 grille/nose faces (`z>1.46`); BodyPaint kept ~100 aft header-tail faces (`|x|≥0.58`, `z≤0.38`). Hiding `StockEngine` correctly hid the wrong faces.
- Decision: After remount, swap those two sets. No punch. Tests lock both counts.
- CONCEPT §6.3 unchanged (v3.95); `npm run cars:bake-donnerbuechse-segmented-engine`

### 2026-08-16 — Donnerbüchse StockEngine remount (no punch)

- Trigger: user — segment out the Donnerbüchse engine and place it back; do not remove any other part
- Decision: The wheels bake already left the exposed motor as a second BodyPaint prim. Remount that prim as `StockEngine` at identity (original verts). Do **not** AABB-carve or punch BodyPaint (that deleted cabin/grille/pipes). A new Tripo `simple` segment over-fragments the bay. Runtime: hide `StockEngine` when Großer Motor is equipped. Cabin, grille, chassis, `StockWheel_*` stay.
- CONCEPT §6.3 Sichtbarkeit → v3.95; `npm run cars:bake-donnerbuechse-segmented-engine`

### 2026-08-16 — Donnerbüchse wheels-only segment

- Trigger: user — segment away the Donnerbüchse wheels
- Decision: Tripo mesh segment v2 simple + connectivity on `donnerbuechse-pre-wheel-segment.glb`. Bake remounts `StockWheel_*` with segment Tire albedo (skinny front, fat rear slicks). Punch ground BodyPaint only — engine prim stays welded (no `StockEngine` node). Große Räder uniform-scales StockWheel_* ×1.35 + hub drop like Bison/Käferkraft (no procedural overlays).
- CONCEPT §6.3 Sichtbarkeit → v3.94; `npm run cars:bake-donnerbuechse-segmented-wheels`

### 2026-08-16 — Blitz Große Räder: detached StockWheel_* 20% wider

- Trigger: user — implement Große Räder on Blitz using detached wheels; wider by 20%, not bigger; replace stock (no overlay)
- Decision: Keep Tripo-segmented `StockWheel_*`. Equip scales axle (width) ×1.2, diameter unchanged, hubs shift outboard by extra half-width so inner faces stay in the wells. No procedural `UpgradeTire`, no stance lift. Bison/Käferkraft still uniform-scale + hub drop.
- CONCEPT §6.3 Sichtbarkeit → v3.93

### 2026-08-16 — Blitz wheels-only segment (revert spoiler punch)

- Trigger: user — revert Blitz wing segmentation; segment wheels only. Punching the GT wing deleted the trunk lid / made the rear vanish when `StockSpoiler` was hidden.
- Decision: new Tripo mesh segment v2 simple + connectivity on `blitz-pre-wheel-split.glb` (`segment-wheels-only-v1`). Bake remounts `StockWheel_*` only. Welded GT wing stays in BodyPaint. Heckspoiler is the extracted overlay `blitz-rear_spoiler.glb` again (not `StockSpoiler` on the car).
- CONCEPT §6.3 Sichtbarkeit; `npm run cars:bake-blitz-segmented-parts`

### 2026-08-15 — Blitz segmented wheels + Heckspoiler

- Trigger: user — Blitz wheels should spin/steer like Bison/Käferkraft; segment the GT wing away from the body
- Decision: Tripo mesh segment v2 simple on `blitz-pre-wheel-split.glb`; bake remounts `StockWheel_*` (segment Tire albedo) + `StockSpoiler`. Punch wing vertices only (not a spoiler AABB — that deleted the trunk lid and left a hole when `StockSpoiler` is hidden). Runtime: wheels roll/steer; `StockSpoiler` shows only with Heckspoiler (no overlay double). Große Räder still hides stock and mounts wider procedural tires.
- CONCEPT §6.3 Sichtbarkeit; `npm run cars:bake-blitz-segmented-parts`

### 2026-08-15 — Architecture skill + static layer guard

- Trigger: user — keep post-refactor architecture/guidelines always followed; add static analysis
- Decision: `.cursor/skills/architecture/` + Cursor subagents in `.cursor/agents/`; `scripts/check-architecture.mjs` (`npm run test:arch`) locks one-way imports, type ownership, one WebGL renderer, rAF homes. CONCEPT unchanged.
- Skills: architecture (new), router/AGENTS, clean-programming, arcade-physics (do not split `vehicle.ts` for size)

### 2026-08-15 — Fast KO + 3s racing-line respawn (CONCEPT v3.92)

- Trigger: user — cars should break way faster, then respawn in the middle of the track in ~3 s
- Decision: Wall/obstacle hits deal much more damage (cooldown still blocks frame-spam). K.O. lasts 3 s. Comeback on the racing line (centerline), facing forward, full HP. HUD shows „K.O. · Comeback n“.
- CONCEPT §§4.4–4.5, §9 HUD, summary → v3.92

### 2026-08-15 — Nitro min charge + slower refill (CONCEPT v3.91)

- Trigger: user — nitro resupplies too fast; players can spray it all the time
- RCA: `boosting` was `nitro > 0`, so an empty tank recharged a crumb then immediately kicked again (rising-edge every other frame while held)
- Decision: Engage only at ≥ ~35 % (HUD mark). Once started, burn until empty or release. Recharge ~0.04/s (~25 s empty→full; ~9 s back to the mark). No crumb spray.
- CONCEPT §§4.2–4.3, §9 HUD, summary → v3.91

### 2026-08-15 — Training mode (CONCEPT v3.90)

- Trigger: user — training where every track can be selected, no other cars, no position at the end
- Decision: New player mode. All cup layouts unlocked. Solo field. 5 laps + countdown + real track. No place/podium/CHF/stars/cup unlock. Mini-map stays (DU only). Not the F4 debug raster.
- CONCEPT §§3, 8.5, 9, 13 → v3.90

### 2026-08-15 — Race HUD: who is where (CONCEPT v3.89)

- Trigger: user — HUD showing self and other players on the track
- Decision: Mini-Map (layout + all cars, player labeled DU) plus Streckenleiste (field order / race progress). Glanceable for 10+; map bottom-right, strip top-center so the racing line stays clear.
- CONCEPT §9 dokumentstand → v3.89

### 2026-08-15 — Faster result movies + locked podium stage (v0.3.194 / CONCEPT v3.88)
- Trigger: user — half the animation time; redo 1st-place car; same podium across images
- Decision: Podium 7.5s / field 2.5s. Shared 2–1–3 block stage. Car always on asphalt behind the podium (never on the blocks). Gold/silver/bronze/field panels regenerated from that stage.
- CONCEPT dokumentstand → v3.88

### 2026-08-15 — Painted Asphalt-Comic result movies (v0.3.192 / CONCEPT v3.87)
- Trigger: user — make new result animations in the game’s asphalt style
- Decision: Replace stick-figure SVG reels with painted cel-shaded panels (gold 3 cuts, silver 3, bronze 3, field 1) + Ken-Burns. Captions stay German. Results screen shows a still from the matching reel.
- CONCEPT dokumentstand → v3.87

### 2026-08-14 — Milder body bank + comic Schanze hops

- Trigger: user — less hard side tilt now wheels steer; jumps more comic than real
- Decision: Visual bank capped ~0.18; Schanzen launch/hang punched up (arcade-exaggerated, still real Y airtime)
- CONCEPT dokumentstand → v3.86

### 2026-08-14 — Wheel spin: real StockWheels, correct axle/steer, no garage roll

- Trigger: user — garage tires still; turn yaw mirrored; Käferkraft wrong axis / fake UpgradeTires
- Decision: No garage idle spin. Steer yaw negated vs stick. Roll axis = thinnest AABB (Bison X, Käferkraft Z). Käferkraft Große Räder scales Tripo `StockWheel_*` like Bison.
- CONCEPT §6.3 Sichtbarkeit synced

### 2026-08-14 — Blitz Leichtbau stats-only (v0.3.166 / CONCEPT v3.85)
- Trigger: user — add lightweight item to Blitz again, but not the art
- Decision: Restore shop/equip for Blitz `lightweight_body` (stats via mergeStats); keep empty mounts / no `blitz-lightweight_body.glb`. Other classes keep Tripo Leichtbau meshes.
- CONCEPT dokumentstand → v3.85

### 2026-08-14 — Blitz drops Leichtbau mesh (v0.3.163)
- Trigger: user — remove lightweight body art from Blitz
- Decision: No Blitz hood-vent GLB; empty mounts; `carSupportsPart("blitz","lightweight_body")` false (same pattern as Bessere Bremsen). Other classes keep Tripo Leichtbau kits.

### 2026-08-14 — no on-car shield mesh (v0.3.159 / CONCEPT v3.84)
- Trigger: user — the mesh in the car should not exist
- Decision: Remove procedural cyan bubble from `fx-shield`; never show on-car shield meshes. Immunity = Style-Popup + damage block; Tripo plaque only overhead round flash.
- CONCEPT dokumentstand → v3.84

### 2026-08-14 — Tripo plaque above car only (v0.3.157 / CONCEPT v3.83)
- Trigger: user — blue Tripo plaque still in the car; reorient and use as round counter above
- Decision: Stop mounting `lap-shield.glb` in on-car `fx-shield` (keep procedural cyan bubble for immunity). Overhead finish flash yaws face (−90°) so plaque faces camera after lookAt; badge on −Z toward camera.
- CONCEPT dokumentstand → v3.83

### 2026-08-14 — v3.75 Auto↔Auto-Bump model
- Trigger: user — cars interact on bump by weight, direction, hit location, relative speed
- Impact: CONCEPT §4.5 (new arcade contact tables); §4.2 cross-ref; arcade-physics contact map; review red line
- Decision: Keep ramming as spice. Formalize four inputs (Masse, Schließspeed, Richtung, Trefferort Bug/Flanke/Heck) with aggressor/victim and readable scene examples. No Pacejka / no ram score.
- CONCEPT dokumentstand → v3.75; impl in v0.3.150 (`resolveContact` + `tests/contact-bump.test.ts`)

### 2026-08-14 — v3.74 Arcade Front-Steer + Bremse→Rückwärts
- Trigger: user — plan for more realistic driving; front-steer path; hold brake → reverse after stop
- Impact: CONCEPT §4.2–4.3, §7.4 Easy Mode note, §9 Hilfe hint, summary; arcade-physics invariants/stat-map
- Decision: Arcade stays (no tire sim). Front-steer = nose leads, velocity follows, no standstill pivot. Same brake action → reverse after near-stop; reverse cap ~35–50%; nitro forward-only. Impl not in this step.
- CONCEPT dokumentstand → v3.74

### 2026-08-14 — Tripo lap-shield as round flash (v0.3.155 / CONCEPT v3.81)
- Trigger: user — round plaque too big; use old Tripo3D plaque
- Decision: Finish-line flash uses compact Tripo `lap-shield.glb` (scale 0.55) + tiny n/m badge; no large canvas RUNDE card

### 2026-08-14 — lap plaque only on finish cross (v0.3.154 / CONCEPT v3.80)
- Trigger: user — use plaque as round counter; only when crossing finish line
- Decision: Hide persistent over-car plaques; flash comic RUNDE n/m ~2.2s after lap increments; HUD keeps ongoing counter

### 2026-08-14 — lap plaque above cars (v0.3.152 / CONCEPT v3.78)
- Trigger: user — round counter is in the car; place above car facing the player
- Decision: Comic **RUNDE n/m** Sprite billboard above each car roof (camera-facing); keep compact HUD lap too

### 2026-08-14 — leave race from settings (v0.3.151 / CONCEPT v3.77)
- Trigger: user — in a race, settings should let the player return to the garage
- Decision: Race settings show **Rennen verlassen** → Garage with no purse/unlock for the aborted run; Esc still only closes the panel

### 2026-08-14 — Esc opens settings (v0.3.149 / CONCEPT v3.76)
- Trigger: user — Esc should open settings; add Settings button in garage
- Decision: Esc/B opens Einstellungen in Garage + Race (Esc again closes); other screens keep Esc = back to Garage. Prominent Einstellungen button in garage hero (footer entry remains).

### 2026-08-14 — garage sit: plant tire AABB (v0.3.148)
- Trigger: user — car still floating in normal garage pose
- RCA: `garageTireColumnContactMinY` missed Blitz treads (no StockWheels), hit a higher underbody, left true tire verts ~12cm under the opaque pad deck; cel outlines + hovering ground blob read as float
- Fix: sit on StockWheels or body AABB min; pin `carGroundBlob` to deck; prefer named `garagePadDeck` for deck Y

### 2026-08-14 — garage sit flush on pad (v0.3.145)
- Trigger: user — car still floating in normal garage pose
- RCA: orbit pivot used full `Box3.setFromObject` (FX skewed center); sit clearance 2 cm still read as a gap
- Fix: body-only bounds for pivot; snap contact to deck after attach/yaw; zero pad clearance

### 2026-08-14 — v3.80 Käferkraft Tripo-segment wheels + cage
- Trigger: user — segment buggy cage + wheels like Bison tire detach
- Decision: Tripo mesh segment v2 simple on `kaeferkraft-pre-cage-split.glb`; bake remounts `StockWheel_*` (comic Tire albedo) + `StockCage`; punch volumes keep BodyPaint atlas. Runtime: hide cage under Verstärkter Rahmen; hide wheels under Große Räder (procedural overlays unchanged).
- CONCEPT §6.3 Sichtbarkeit minor sync; `npm run cars:bake-kaeferkraft-segmented-parts`

### 2026-08-14 — v3.74 Bison Federung keeps stock wheel size
- Trigger: user — Bison offroad suspension should not enlarge wheels
- RCA: `bisonLowersStockWheels` / `bigWheelScaleFor` treated Federung like Große Räder (shared 1.35× scale + hub drop)
- Decision: Only `big_wheels` scales/drops `StockWheel_*`. Federung mounts Blitz shocks at stock hub Y + `suspensionLift` (no tire enlarge). Stance stacks when both equipped.
- CONCEPT §6.3 Sichtbarkeit → v3.74

### 2026-08-14 — garage sit: orbit pivot via attach (v0.3.141)
- Trigger: user — car always in the air; should sit on the floor
- RCA: parenting scaled showcase car with `worldToLocal` → position offset ignored scale → tires floated ~0.4 above pad
- Fix: `mountGarageOrbitPivot` uses `Object3D.attach` to keep world transform

### 2026-08-14 — v3.73 Bison Gelände-Federung (Blitz shocks)
- Trigger: user — re-enable offroad suspension on Bison using Blitz Tripo shock absorbers
- Decision: Shop allows `offroad_suspension` on Bison; mounts `blitz-offroad_suspension.glb` at wheel arches. Equipping it lowers/scales `StockWheel_*` like Große Räder (shared stance, no double lift) so shocks visually bridge frame → big wheels.
- CONCEPT §6.3 Sichtbarkeit → v3.73

### 2026-08-14 — v3.72 Garage inspect release snaps flat on pad
- Trigger: user — bring car back horizontal + to floor when RMB released
- Decision: Harden release (lostpointercapture / mouse idle clear); snap pitch to 0 and drop lift immediately on inspect end (CONCEPT §9)
- CONCEPT §9 already stated Loslassen → flach; implementation hardened

### 2026-08-14 — v3.71 Garage inspect lift to mid-screen
- Trigger: user — vertical pitch lift too high; should sit mid-screen
- Decision: Inspect hover targets fixed mid-frame Y (~2) instead of half-extent clearance; camera lookAt follows pivot while held
- CONCEPT §9 (anheben) unchanged in wording; framing fix only

### 2026-08-14 — v3.70 Race start countdown 3…2…1…GO
- Trigger: user — countdown at race start, 4 seconds total
- Decision: Hold field for 4 s with HUD phases 3 / 2 / 1 / GO (1 s each); cars frozen; SFX on phase change; then normal race
- CONCEPT §9 → v3.70

### 2026-08-14 — v3.69 Settings + Easy Mode auto-throttle
- Trigger: user — settings on right click; easy mode without holding up/gas for full speed
- Decision: Einstellungen panel (RMB outside garage canvas / button); `easyMode` localStorage; force throttle=1 unless braking. Default off (CONCEPT §7.4).
- CONCEPT §7.4 / §9 → v3.69

### 2026-08-14 — v3.68 Garage inspect pivots at car center
- Trigger: user — vertical pitch in air not good; lift and turn on the spot around car middle
- Decision: Orbit pivot at bbox center; fixed inspect lift (not pitch-dependent clearance); yaw/pitch on pivot so tumble stays in place
- CONCEPT §9 → v3.68

### 2026-08-14 — v3.67 Garage pitch mode release snaps flat
- Trigger: user — releasing vertical pitch mode should put the car horizontal again
- Decision: Ending RMB / 2-finger inspect resets `garagePitch` to 0 (sit back on pad); yaw kept
- CONCEPT §9 → v3.67

### 2026-08-14 — v3.66 Garage RMB free tumble + pad hover
- Trigger: user — right click pitches all directions; lift car so it does not clip the floor
- Decision: RMB / 2-finger = yaw+pitch; hover lift while inspect held + pitch-based floor clearance from half-extents
- CONCEPT §9 → v3.66

### 2026-08-14 — v3.65 Garage pitch via two-finger touch
- Trigger: user — two finger touch for vertical pitch on tablets
- Decision: Touch/pen 1 finger = yaw only; 2+ fingers = pitch only. Mouse unchanged (LMB yaw / RMB pitch).
- CONCEPT §9 → v3.65

### 2026-08-14 — v3.64 Garage pitch on right-click
- Trigger: user — vertical pitch only with right click
- Decision: Mouse LMB = yaw only, RMB = pitch only (context menu suppressed on canvas). Touch/pen keep both axes (no secondary button).
- CONCEPT §9 → v3.64

### 2026-08-14 — v3.63 Garage free yaw + pitch orbit
- Trigger: user — cars should turn in all directions; code only yawed
- Decision: CONCEPT §9 „frei drehen“ = horizontal drag yaw + vertical drag pitch (clamp ±π). Wire `applyGarageDragOrbit` through GameApp → RaceRenderer (Euler YXZ).
- CONCEPT §9 → v3.63

### 2026-08-14 — v3.62 Drop Bessere Bremsen on Bunker
- Trigger: user — bunker: remove the art for the better brakes
- Decision: `better_brakes` dropped for Bunker (like Blitz/Bison/Käferkraft): shop/kits strip via `carSupportsPart`; empty brake anchors / no caliper meshes. Only Donnerbüchse keeps the part.
- CONCEPT §6.3 Sichtbarkeit → v3.62

### 2026-08-14 — v3.61 Bunker wheels detached + scaled for Große Räder
- Trigger: user — bunker: detach grey wheels and make them bigger for big wheels
- Decision: Bake `StockWheel_FL/FR/RL/RR` (Tire mat) out of Bunker BodyPaint dark-grey islands. Große Räder scales those meshes (~1.55×) instead of procedural UpgradeTire — same path as Käferkraft/Donnerbüchse.
- CONCEPT §6.3 Sichtbarkeit → v3.61

### 2026-08-14 — v3.60 Käferkraft wheels detached + scaled for Große Räder
- Trigger: user — buggy: detach wheels; bigger wheels = upscaled normal wheels
- Decision: Bake `StockWheel_FL/FR/RL/RR` out of Käferkraft BodyPaint (recentered). Runtime skips re-extract when authored. Große Räder scales those meshes (~1.35×) instead of procedural UpgradeTire; other cars keep hide+procedural.
- CONCEPT §6.3 Sichtbarkeit → v3.60

### 2026-08-14 — v3.59 Drop Bessere Bremsen on Käferkraft
- Trigger: user — buggy: remove the better brakes item art
- Decision: `better_brakes` also dropped for Käferkraft (like Blitz/Bison): shop/kits strip via `carSupportsPart`; empty brake anchors / no caliper meshes. Donnerbüchse and Bunker keep the part.
- CONCEPT §6.3 Sichtbarkeit → v3.59

### 2026-08-13 — v3.57 Drop Bessere Bremsen on Bison
- Trigger: user — remove improved brakes items from Bison
- Decision: `better_brakes` also dropped for Bison (like Blitz): shop/kits strip via `carSupportsPart`; empty brake anchors / no caliper meshes until a fitting kit exists. Other classes keep the part.
- CONCEPT §6.3 Sichtbarkeit → v3.57

### 2026-08-13 — v3.55 Arcade SFX (CC0) + mute
- Trigger: user — add sound effects; search proper free SFX
- Decision: ship curated **CC0** samples (Kenney UI + OGA engine loops + 100 CC0 / breaking hits); Web Audio bus (`src/audio/`); race emits player-centric cues; Mute in Garage/Hilfe/HUD (localStorage)
- CONCEPT §9 / summary → v3.55

### 2026-08-13 — v3.54 Podium 2D movies + field disappointment
- Trigger: user — 15s 2D movie for podium ranks (distinct 1/2/3) + disappointed driver when not top 3
- Decision: Asphalt-Comic CSS/SVG reels — gold/silver/bronze ~15s; field ~5s sad driver; finish overlay hosts the movie before results
- CONCEPT §9 → v3.54

### 2026-08-13 — v3.53 Player-visible AI credit
- Trigger: user — common in-game credit that Crash Circuit was AI-created under human direction
- Decision: short German line „Mit KI erstellt · menschliche Anleitung“ next to version on Hilfe and garage wallet; not a manifesto
- CONCEPT §9 Hilfe → v3.53

### 2026-08-13 — v3.52 Five laps + start-line lap shield
- Trigger: user — make races 5 laps; lap shield when going through start; Tripo mesh
- Decision: all modes default **5 Runden**; crossing S/F grants ~2s damage immunity + Tripo comic shield FX + „Schild!“
- CONCEPT §3 / §4.5 / pacing → v3.52

### 2026-08-13 — v3.51 Drop Bessere Bremsen on Blitz

- Trigger: user — remove improved brakes from Blitz (yellow caliper blocks clipping the coupe)
- Decision: `better_brakes` stay on other classes; Blitz shop/kits strip the part (`carSupportsPart`); no brake anchors / meshes on Blitz until a fitting kit exists.
- CONCEPT §§ touched: §6.3 Sichtbarkeit → v3.51

### 2026-08-13 — v3.47 Tripo-only silhouette Teile on cars
- Trigger: user — Käferkraft mounts wrong; cars must use Tripo3D art only for Teile
- Decision: CONCEPT §6.3 — silhouette Teile = per-car Tripo/extract GLBs only; procedural only for brakes/wheels hints (+ temporary Blitz frame/lightweight allowlist until rematched). Käferkraft mounts retuned to parts-look; lightweight Tripo kit shipped.
- Impl: `carParts.ts` mounts + `kaeferkraft-lightweight_body.glb`; agent skill + tests lock Tripo-only
- CONCEPT dokumentstand → v3.47

### 2026-08-13 — v3.46 Oversteer auto-drift + accel/nitro retune
- Trigger: user — drift into hard corners; wrong drift pose; slower accel; stronger nitro
- Decision: CONCEPT §4.2–4.3 — Drift = Taste **oder** Oversteer; langsameres Gas; knackigeres Nitro
- Impl: outward rear kick; slip-angle lean; BASE_ACCEL 15; BASE_NITRO 125 / kick 14
- CONCEPT dokumentstand → v3.46

### 2026-08-13 — v3.45 Parts preview then buy
- Trigger: user — parts should preview first, buy in a second step
- Decision: Shop Teile: tap = bay + Eigenschaften Vorschau; Kaufen spends part price and equips; owned parts still toggle An/Aus
- CONCEPT §6.2 / §9 → v3.45

### 2026-08-13 — v3.44 Cosmetics preview then buy
- Trigger: user — stickers and paints must be bought; preview first
- Decision: Per-car `ownedPaints` / `ownedStickers`; tap = Vorschau on bay; Kaufen spends CHF (75 paint / 100 sticker); default paint + Kein/Glatt free; old saves grant equipped looks
- CONCEPT §6.2 / summary → v3.44

### 2026-08-13 — v3.43 Remove Bunker IronClad sticker
- Trigger: user — remove ironclad sticker from Bunker
- Decision: Drop `ironClad` sticker id; Bunker uses shared Aufkleber (Kein/Flammen/Blitz/Stern); old saves sanitize to `none`
- CONCEPT §9 cosmetics → v3.43

### 2026-08-12 — v3.41 Theme Tripo scenery for cups 2–5
- Trigger: user — Tripo assets for all tracks except Havenstadt matching proposals; nothing on the racing surface; sky/surround textures same treatment
- Decision: 10 theme props (grandstand/palm/hut/tower/building/cliff/spire/tree/warehouse/scrub) via concept→Tripo→bake; outer-side placement + `SCENERY_CLEARANCE=12`; panorama/sky refreshed per proposal; Hafenstart kit unchanged
- CONCEPT §§ touched: §8.2 → v3.41

### 2026-08-12 — v3.42 Dedicated Drift button (Kart-style)
- Trigger: user — still no drifting
- Decision: Explicit Drift on Strg/E, LB/L1, Touch; powerslide only while held + steer; HUD indicator
- CONCEPT §4.2 → v3.42

### 2026-08-12 — v3.40 Arcade powerslide + punchy nitro
- Trigger: user — Mario Kart / Split Second feel; drifting missing; nitro lame
- Decision: CONCEPT clarifies arcade powerslide (not tire sim) + kick nitro; `vehicle.ts` driftIntent/mini-turbo + nitroKick/headroom
- CONCEPT §§4.2–4.3 → v3.40

### 2026-08-12 — v3.39 Arcade-physics skill (subagent)
- Trigger: user — subagent that owns physics so it can evolve
- Decision: `.cursor/skills/arcade-physics/` (SKILL + stat-map + evolution) + router/AGENTS/TECH/CONCEPT §4.2 pointer; feel changes go through evolve checklist + feel tests
- CONCEPT §§: §4.2 authorship → v3.39

### 2026-08-12 — v3.38 Theme Tripo scenery for cups 2–5
- Trigger: (interim log while physics bumps landed; superseded by v3.41)
- Decision: same intent as v3.41
- CONCEPT §§ touched: §8.2

### 2026-08-12 — v3.37 Arcade driving physics from Eigenschaften
- Trigger: user — proper arcade physics (accel, brake, slide, jump, turning, mass push, nitro) scaled by car Eigenschaften
- Decision: `vehicle.ts` maps Beschleunigung/Tempo/Grip/Handling/Gewicht/Federung/Nitro (+ brakeBonus from Bessere Bremsen) into arcade forces; Schanzen launch real Y airtime; car–car impulse by mass; render uses `car.y`
- CONCEPT §§ touched: §4.2, §4.3, §4.6 → v3.37

### 2026-08-12 — v3.36 Cup routes 2–5 + sky/panorama surround
- Trigger: implement track proposals (all cups except Hafenstart); sky dome + panoramic far/infield meshes; reuse Havenstadt props
- Decision: Parabolbogen / Schikanenring (risk-reward) / Omegatal / Kuppenfinale in `levels.ts`; `panoramaSurround.ts` for dome + horizon cylinder + infield disc; city/beach/factory reuse crane/container/silo kits
- CONCEPT §§ touched: §8.2 → v3.36

### 2026-08-12 — v3.35 Tripo 3D assets agent skill
- Trigger: user — analyze original Blitz Teile pipeline; teach agents to generate 3D assets
- Decision: New skill `.cursor/skills/tripo-3d-assets/` (SKILL + pipeline cookbook) documents concept → `tripo make` → bake → mount. Wired into skills-router, AGENTS.md, parts README, TECH.md. Policy: per-class kits / no Blitz remount on other cars.
- CONCEPT §§: tooling only

### 2026-08-12 — v3.34 Class-shaped Teile (no shared Blitz kits)
- Trigger: user — parts placement must match parts-look concepts; generate parts where needed
- Decision: Tripo/extracted GLBs only on **Blitz**. Other cars use improved procedural builders (hotrod perforated rails, pickup bed cage, armor exo, roof/tri cutouts, tall/roof spoilers, bed+bullbar nitro). Anchors retuned to mesh bounds / look sheets. Surface snap kept for hood/deck.
- CONCEPT §§: §6.3 visuals only

### 2026-08-12 — v3.33 Aufkleber art: Racepool red + hotrod flames
- Trigger: user — Stern/Blitz like racepool99.de/rennstrecken; Flammen like original Donner hotrod
- Decision: sticker-v6 canvas (no cream plate). Stern = flat `#E63212` racepool-track-red stars. Blitz = Racepool wordmark style (italic RAC + three-bar red E + POOL + red underline, **no 99**). Flammen = solid orange three-tongue hotrod silhouette (no yellow core). Proposals refreshed under `assets/tripo-concepts/sticker-proposal-*.png`.
- CONCEPT §§: §6.2 cosmetics only (no rule change)

### 2026-08-12 — v3.32 Blitz Tripo cabin glass restored
- Trigger: user — Blitz windows looked worse after opaque seal; Tripo art was better
- Decision: Remove runtime opaque windshield/side planes and stop darkening glass texels in the wing-strip extract bake. Keep Tripo cabin glass albedo on stock `blitz.glb`.
- CONCEPT §§: visuals only (no rule change)

### 2026-08-12 — v3.43 Hafenstart panorama surround (no box basin)
- Trigger: Havenstadt still showed random box props (ship/quay/water patches) and lacked a readable harbor background when looking out; infield was a modelled box basin
- Decision: Distant harbor is **sky dome + panoramic horizon cylinders + infield disc** (authored PNG plates under `public/textures/panorama/`, canvas fallback). Near-track scenery is sparse Tripo kit only (crane/container/warehouse/tank). Removed box ship/quay/bollard/basin. Fog pushed out so the surround reads.
- CONCEPT §§ touched: §8 Hafen theme feel (backgrounds) — visuals only

### 2026-08-12 — v3.31 Hafenstart harbor surroundings (no green wall)
- Trigger: Hafenstart infield/horizon read as a solid green wall; surroundings too empty for a harbor
- Decision: **RCA verified:** `ExtrudeGeometry` along closed CatmullRom Frenet-flipped the grass/asphalt ribbons into ~19 m vertical walls. Fix: world-up `flatRibbonGeometry`. Harbor theme ground is pier-gray (not grass). *(Superseded for basin/box props by v3.43 panorama surround.)* Concept art: `assets/art-style/harbor-surroundings.png`. Track asphalt→grass→wall language unchanged.
- CONCEPT §§ touched: §8 Hafen theme feel (backgrounds) → dokumentstand v3.31

### 2026-08-12 — v3.30 Tripo Teile on all cars + surface snap
- Trigger: replace procedural Teil meshes with Tripo3D kits; place smoothly on each body
- Decision: Prefers `/models/parts/blitz-*.glb` on every class (per-car anchors/scale/yaw). Hood/deck parts sit via body-surface Y sample; bumpers/frames/springs stay fixed. Heckspoiler stays extracted original wing (bake no longer overwrites it). Procedural builders = fallback + brakes/wheels only.
- CONCEPT §§ touched: §6.3 Sichtbarkeit → v3.30

### 2026-08-12 — v3.29 Aufkleber as projected body decals

- Trigger: user — stickers don’t work as defined; Tripo OK if needed
- Decision: Tripo albedo UV stamps miss doors (chaotic atlases). Project sticker-v5 comic plates with `DecalGeometry` onto BodyPaint (Seite/Haube/Tür). Käferkraft stays nose GLBs. No Tripo bake required for flat decals.
- CONCEPT §§ touched: §6.2 Aufkleber-Details → v3.29

### 2026-08-13 — v3.50 Flammen Tripo plaque

- Trigger: user — Flame sticker still bland; use Tripo3D for a nice one
- Decision: Asphalt-Comic concept → Tripo image-to-mesh+texture → bake `flames.glb` relief on side/door anchors; concept-stripped PNG as 2D albedo/preview. Bolt/star remain canvas.
- CONCEPT §§ touched: §6.2 Aufkleber-Details → v3.50

### 2026-08-13 — v3.49 Stickers: Stern trail + Blitz bolt, side only

- Trigger: user — “Bolt sticker” is actually star vinyl (good on side); remove from front; make new Bolt sticker
- Decision: Reassign shooting-star trail art to `star` (Stern); new comic lightning zigzag for `bolt` (Blitz). Drop hood/front decal anchors (Bison side-only like other cars). Texture cache `sticker-v12`.
- CONCEPT §§ touched: §6.2 Aufkleber-Details → v3.49

### 2026-08-13 — v3.48 Removable wheels + brakes + offroad catalog

- Trigger: user — make wheels removable; fix bigger wheels / brakes / offroad suspension across cars
- Decision: Split stock tire triangles into `StockWheel_*` at GLB normalize; `big_wheels` hides them and mounts procedural upgrade tires (Blitz = wider, others = larger diameter) plus stance lift. Keep procedural better_brakes (look sheets exist). `offroad_suspension` only for Blitz (ships `blitz-offroad_suspension.glb`); dropped from other cars’ shop/kits — those use tire stance from Große Räder instead.
- CONCEPT §§ touched: §6.3 Sichtbarkeit → v3.48

### 2026-08-12 — v3.28 Equipped Teile visuals on every car

- Trigger: user — implement car parts as proposed in the parts-look sheets
- Decision: Every class shows equipped Teile as Asphalt-Comic add-ons (procedural builders + Blitz Tripo GLBs where present). Per-car mounts match `assets/tripo-concepts/parts-look/` (e.g. Käferkraft rear engine, Bison bed nitro, Bunker roof wing). `better_brakes` = visible calipers; `big_wheels` = stance + tire bulk hints (no fake WheelSpin hubs). Meshes still grant **no stats**.
- CONCEPT §§ touched: §6.3 Sichtbarkeit → v3.28

### 2026-08-12 — v3.27 Blitz scoop place + original wing + sealed glass

- Trigger: user — Big Engine wrong place; missing front window looks bad (opaque OK); replace Heckspoiler item with original car wing
- Decision: Restock Blitz from wing-stripped pre-wing-free bake (opaque darkened glass + runtime cabin glass seal). Heckspoiler GLB is the extracted original rear wing. Großer Motor scoop yaw 180° and hood-forward placement so intakes face the nose, clear of the windshield.
- CONCEPT §§ touched: Dokumentstand v3.27 (cosmetics/parts visuals only)

### 2026-08-12 — v3.26 Aufkleber redraw + flame-free Donner + garage ring

- Trigger: finish Blitz-Teile plan leftovers (stickers, garage frustum, dead wheels)
- Decision: Canvas Aufkleber v4 (Hot-Rod Flammen / Blitz-Bolt / Stern / IronClad). Donnerbüchse stock albedo stripped of baked door flames; paint path also recolors residual flame texels. Garage STOCK/HERO pulled into a tight ring outside pad r=4.5. Dead comic-wheel module/asset removed. Blitz Teile remain stance-lift + add-on meshes (no fake hubs).
- CONCEPT §§ touched: Dokumentstand v3.26; cosmetics §6.2 unchanged (no stats)

### 2026-08-12 — v3.25 Unique cup track plans + Schanzen

- Trigger: user — 2D top-down plan for every race, unique look matching the name, different track form; Schanzen allowed
- Decision: Redesign the five Blitz-Cup layouts with distinct silhouettes (stadium / long coastal / city square / factory plates / canyon triangle). Cup/Free/Ad-hoc UI shows Asphalt-Comic SVG track plans with theme tints. Passable `ramp` obstacles (Schanzen) on Buckelpiste and Cup-Finale; drive-over bump, not solid walls.
- CONCEPT §§ touched: Dokumentstand v3.25; obstacle palette aligns with level-editor `ramp`

### 2026-08-11 — v3.24 Blitz equipped-Teile meshes

- Trigger: user — Blitz should show small Asphalt-Comic add-on meshes for equipped tuning parts
- Decision: Visualize `kit.equippedParts` with small Tripo props (spoiler, scoop, nitro, spikes, springs, hoop, vents). `big_wheels` scales existing wheel hubs; `better_brakes` skipped until calipers exist. Meshes grant **no stats** — only `mergeStats`. Paint/stickers stay cosmetic. Unequip hides the mesh.
- CONCEPT §§ touched: §6.3 Sichtbarkeit → v3.24

### 2026-08-11 — v3.23 Bison + Donnerbüchse Tripo meshes

- Trigger: user — redo Bison (pickup) and Donnerbüchse (hot rod) via the Blitz Tripo pipeline
- Decision: Authoring-time Tripo from Asphalt-Comic 3/4-front concepts; runtime ships baked GLBs (no Tripo at play). Nose +Z. Garage paint recolors green (Bison) / blue (Donnerbüchse) body pixels; tires, chrome engine, orange flames, and bed liner stay. Side (+ hood on Bison) stickers remain cosmetic with no stats.
- CONCEPT §§ touched: Dokumentstand v3.23 (class look in §2 / §5.1 / cosmetics in §6.2 unchanged)

### 2026-08-11 — v3.22 Bunker Tripo APC mesh

- Trigger: user — redo the Bunker
- Decision: Authoring-time Tripo from Asphalt-Comic 3/4-front APC concept; runtime ships baked GLB (no Tripo at play). Nose +Z. Garage paint recolors pale armor pixels; yellow stripe and charcoal trim stay. IronClad remains a side/door sticker (no stats).
- CONCEPT §§ touched: Dokumentstand v3.22 (class look in §5.1 / Tür-Badge in §6.2 unchanged)

### 2026-08-11 — v3.21 Blitz Tripo GT mesh

- Trigger: user — generate a new Blitz car with Tripo3D
- Decision: Authoring-time Tripo from Asphalt-Comic 3/4-front concept; runtime ships baked GLB (no Tripo at play). Nose +Z like the previous sport mesh. Garage paint recolors red body pixels; side stickers stay on. Cosmetics still no stats.
- CONCEPT §§ touched: Dokumentstand v3.21 (class look in §2 / §5.1 unchanged)

### 2026-08-11 — v3.20 Garage car preview then buy

- Trigger: user — clicking a car that must be bought should show a clearly marked preview, plus a Buy button
- Decision: Unowned roster click = Vorschau (3D + stats, no CHF, no race switch). **Kaufen** spends CHF and activates. Tuning locked until owned.
- CONCEPT §§ touched: §6.2, §9 → v3.20

### 2026-08-11 — v3.19 Käferkraft Tripo mesh + noses

- Trigger: user — better-looking buggy than GetGLB; alternative fronts (skull, dog, bird) via Tripo3D
- Decision: Authoring-time Tripo from Asphalt-Comic concepts; runtime ships baked GLBs (no Tripo at play). Bare bumper + three bumper-ornament props. Garage paint recolors orange body pixels. Cosmetics still no stats.
- CONCEPT §§ touched: Dokumentstand v3.19 (rules in §6.2 unchanged)

### 2026-07-26 — v3.18 Käferkraft nose label Vogel + stylized pigeon

- Trigger: user — “Bidr” misspelled → Vogel; replace bird with Sketchfab stylized pigeon; face forward, feet on frame
- Decision: CC-BY pigeon by AnimalMesh 3D (API: commercial OK). Garage chip “Vogel”. Perch pose on front crossbar.
- CONCEPT §§ touched: §6.2 → v3.18

### 2026-07-26 — v3.17 Käferkraft bumper lamps are car headlights

- Trigger: user — red Totenkopf lamps belong to the car; style as front headlights with textures
- Decision: EyeRed meshes stay visible on all nose variants; comic headlight atlas (chrome bezel + warm lens). Only Skull + front horns toggle with Totenkopf.
- CONCEPT §§ touched: §6.2 → v3.17

### 2026-07-26 — v3.16 Käferkraft nose props (Bidr / Hund)

- Trigger: user — horns belong to skull; default bare; Stier→Bidr bird; Sternkopf→Hund dog
- Decision: Free3D links were Personal Use / blocked → Sketchfab CC-BY bird + sitting dog. Skull+Dark horns toggle together. Default kit sticker `none`.
- CONCEPT §§ touched: §6.2 → v3.16

### 2026-07-26 — v3.15 Sticker textures + buggy nose

- Trigger: user — textures instead of overlays; car-specific stickers; buggy nose models; Bunker ironClad door replaceable
- Decision: Bake stickers into albedo (side/hood/door). Käferkraft uses nose mesh variants (not decals). Bunker door UV slots swap IronClad badge.
- CONCEPT §§ touched: §6.2 → v3.15
- Impl: `carStickers.ts`, `buggyNose.ts`

### 2026-07-25 — v3.11 Readable track layouts

- Trigger: user — no unclear passables; no self-cross (else bridge+wall); clear corridor; cannot leave track
- Decision: Cups/ad-hoc = same-turn ovals (no figure-8). Solid blockers at verge only. Passable = low rumble/oil with markings. Walls keep cars in. Bridges deferred until a layout truly needs a crossing.
- CONCEPT §§ touched: §4.4 layout rules, §4.6 obstacle clarity → v3.11
- Skills: level-editor checklist + track-spec; validateTrack self-cross tests

### 2026-07-25 — v3.10 Arcade driving feel

- Trigger: user — improve car driving to feel more like a racing game
- Decision: Keep “Gewicht + Grip + Impuls” (no full drift sim). Velocity can slip vs heading; yaw rate drops at high speed; lighter drag / coast; punchier accel/nitro. Tests lock steer curve, coast, slip angle.
- CONCEPT §§ touched: §4.2 → v3.10
- Impl: `src/sim/vehicle.ts` stepCar rewrite

### 2026-07-25 — v3.7 Category-faithful car silhouettes

- Trigger: user — art should strive for looks close to real cars of each category; sample target image
- Decision: Keep Asphalt-Comic (cel, outlines, flat color — not photoreal materials). Add rule that proportions/type cues match real category vehicles and stay engine-renderable. Canonical sample sheet: `assets/art-style/car-category-targets.png`
- CONCEPT §§ touched: §2 visual; §5.1 art note; §13 summary → v3.7
- Skills: asphalt-comic-art SKILL + style-bible vehicle targets

### 2026-07-25 — v3.6 Garage is the home hub

- Trigger: user — boot into garage; emphasize equipping; make garage look good
- Decision: Default screen = Garage with race CTAs + equip-first parts UI; comic 3D bay backdrop; slim Hilfe screen replaces old main menu hub
- CONCEPT §§ touched: §9 UX flow → v3.6
- Skills: asphalt-comic garage look; review e2e updated for garage-first boot

### 2026-07-25 — v3.5 Per-car kits + class silhouettes

- Trigger: user — distinguishable car models; add-ons must not auto-share across car types
- Decision: Sport (Blitz) vs Pick-up (Bison) get distinct comic meshes; save v2 stores parts/paint/sticker per car; v1 global inventory migrates onto the then-active car only
- CONCEPT §§ touched: §5.1 kits note; §13 summary → v3.5
- Skills: asphalt-comic silhouettes; clean-programming tests for migration RCA

### 2026-07-25 — v3.4 Ad-hoc seed tracks shipped

- Trigger: user — continue next step after MVP tech order complete
- Decision: Implement CONCEPT §8.4 ad-hoc from segment stitch + shareable seed in main menu
- CONCEPT/TECH touched: §11 Danach → delivered note; TECH build order step 9; footer → v3.4
- Skills: level-editor rules followed (asphalt→grass→wall, tire corners)

### 2026-07-25 — v3.3 Session pacing 7–15 min

- Trigger: user — planned pacing so 7–15 min can unlock or buy something meaningful
- Decision: Successful short session = 7–15 min; ≤2 intro mid-pack races afford a starter part; P1 first race affords a solid early part; early cups prefer 2 laps
- CONCEPT §§ touched: §3 loop, §4.8 economy pacing, §13 summary → v3.3
- Skills synced: review-testing doability checklist; game-concept evolution log
- Impl: intro purses, starter part prices, early cup laps, economy pacing tests

### 2026-07-25 — v0.2.3 Start scripts bootstrap Node

- Start scripts download portable Node into `.tools/` when Node is not preinstalled
- Unix: curl|wget|python3 + tar; Windows: PowerShell download/expand; bat delegates to ps1

### 2026-07-25 — v0.2.1 Cross-platform start scripts

- Added `start.sh`, `start.bat`, `start.ps1` + alwaysApply rule that they must keep working
- README / AGENTS / skills-router updated

### 2026-07-25 — v0.2.0 MVP implementation

- Trigger: user — implement the MVP
- Shipped: 2 cars, 5 cup levels, free mode, garage (paint/stickers/parts/synergies), race sim with zones/damage/heal/KO/catch-up/AI, DE UI, keyboard+gamepad+touch
- Version 0.2.0 on master

### 2026-07-25 — v3.2 Stack adopted + master-only delivery

- Trigger: user — use recommended tech; each step versioned, committed, pushed to master; no branches
- Decision: Adopt TS/Vite/three.js stack; delivery invariant #12; scaffold as v0.1.0 on master
- CONCEPT/TECH/AGENTS/rules synced; clean-programming DoD updated

### 2026-07-25 — v3.1 Free-only tech stack recommendation

- Trigger: user asked for optimal free-to-use tech stack
- Decision: Primary = TypeScript + Vite + three.js + HTML UI + Vitest/Playwright; alt = Godot 4; reject Unity/Unreal as deps; custom arcade physics first
- CONCEPT §§ touched: §12, §13 footer → v3.1; new `TECH.md`
- Skills synced: game-concept invariant #11
- Impl follow-ups: scaffold Vite/TS when ready to prototype

### 2026-07-25 — v3 Controller + Tablet required

- Trigger: user — game must be playable with controller and on tablet
- Decision: keyboard, gamepad, and tablet touch are first-class (race + menus); moved out of “Danach”
- CONCEPT §§ touched: header platform, §4.2, §7.4, §9, §11 MVP, §13 → v3
- Skills synced: game-concept invariant #10, review-testing doability/UX
- Impl follow-ups: input layer, focus UI, touch controls, tablet layout QA

### 2026-07-25 — Skill router + always-use

- `AGENTS.md` + `.cursor/rules/skills-router.mdc` mandate reading every matching project skill
- All five skills: alwaysApply rules; descriptions use “Always use when…”
- Level-editor rule elevated to alwaysApply (conditional body)

### 2026-07-25 — v2 baseline locked into skills

- Core = tuned racing speed; ramming = spice
- Damage heals over time + FX; track asphalt→grass→wall
- CHF; stickers; free + ad-hoc modes; catch-up with skill ceiling
- Art = Asphalt-Comic
- Skills: asphalt-comic-art, level-editor, clean-programming, review-testing, game-concept

### Template

```markdown
### YYYY-MM-DD — vN <title>
- Trigger: …
- Decision: …
- CONCEPT §§ touched: …
- Skills/levels synced: …
- Impl follow-ups: …
```

## Amendment patterns

| Situation | Pattern |
|-----------|---------|
| User corrects design | Update CONCEPT → sync skills → fix code |
| Code discovers edge case | Propose CONCEPT rule → approve → implement |
| Playtest fails doability | Prefer UX/tuning in CONCEPT + review-testing; avoid silent mechanic rewrites |
| Scope creep | Park under CONCEPT “Danach” / open decisions; do not half-implement |

## Alignment anti-patterns

- Feature ships only in code with no CONCEPT line  
- CONCEPT says A, HUD teaches B  
- Level JSON breaks cross-section rules  
- “Temporary” ram button left in  
- New currency or English-only UI “just for MVP” without CONCEPT change  
