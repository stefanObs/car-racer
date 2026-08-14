# Concept Evolution

## Versioning

Track in the footer of `CONCEPT.md`:

```text
*Dokumentstand: Konzept vN — <one-line focus>.*
```

Bump **N** when invariants, core loop, economy, modes, or art lock change. Typos / clarity-only edits need no bump.

## Decision log

Append newest first.

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
