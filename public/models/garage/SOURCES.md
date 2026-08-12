# Garage workshop props (Tripo bake)

Authoring-time Tripo3D image-to-mesh from Asphalt-Comic concepts under `assets/tripo-concepts/garage-*.png`. Runtime ships the baked GLBs (no Tripo at play time).

## Workshop stock

Rebuild: `npm run garage:bake-tripo` (needs gitignored `assets/tripo-out/garage/`).

| Prop | File | Notes |
|------|------|--------|
| Tool cabinet | `cabinet.glb` | ~2 m tall, doors/handles |
| Workbench | `workbench.glb` | Tools on top |
| Tire stack | `tire-stack.glb` | Black/orange comic tires |
| Inventory shelf | `shelf.glb` | Generic crates / boxed parts |
| Oil drums | `drums.glb` | Pair with hazard stripe |
| Tool chest | `toolchest.glb` | Red rolling chest (~1.15 m) |
| Gas bottles | `gas.glb` | Twin tanks on a rack (~1.35 m) |
| Engine hoist | `hoist.glb` | Yellow cherry-picker (~2.4 m) |

Materials named **BodyPaint**; comic albedo atlas kept. Front is Tripo +X; sit on y=0.

## Bay shell (floor / wall / turntable)

Rebuild: `npm run garage:bake-shell-tripo`.

| Asset | Files | Notes |
|-------|-------|--------|
| Floor | `floor.glb` + `floor-albedo.png` | Tripo slab mesh + orthographic comic albedo sheet |
| Wall | `wall.glb` + `wall-albedo.png` | Tripo panel mesh + wall albedo sheet |
| Turntable | `turntable.glb` + `turntable-albedo.png` | Tripo disc mesh used on the pad; sheet maps the top |

Concepts: `garage-*-slab/panel/turntable.png` (Tripo) and `garage-*-albedo-sheet.png` (planar maps). Tripo UV atlases are **not** used as plane tiles — sheets are.
