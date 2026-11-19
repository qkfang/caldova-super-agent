import pathlib

p = pathlib.Path("src/neighbourhoodScene.ts")
t = p.read_text(encoding="utf-8")


def sub(old: str, new: str, count: int = 1) -> None:
    global t
    n = t.count(old)
    if n != count:
        raise SystemExit(f"expected {count} match(es), found {n}: {old[:90]!r}")
    t = t.replace(old, new)


def cut(start: str, end: str, replacement: str) -> None:
    global t
    if t.count(start) != 1:
        raise SystemExit(f"start marker count {t.count(start)}: {start[:80]!r}")
    s = t.index(start)
    e = t.index(end, s + len(start))
    t = t[:s] + replacement + t[e:]


# --------------------------------------------------------------- imports
sub(
    """import {
  NeighbourhoodAmbient,
  buildCarMeshes,
  buildFireTruckMeshes,
  buildVanMeshes,
  buildJeepMeshes,
  buildTowTruckMeshes,
  makeCalmGlowIncident,
  makeLuggageIncident,
  makeRearEndIncident,
  makeSmokeIncident,
} from "./neighbourhoodAmbient";""",
    """import {
  NeighbourhoodAmbient,
  buildCarMeshes,
  buildVanMeshes,
  buildJeepMeshes,
  makeCalmGlowIncident,
  makeCelebrationIncident,
  makeHardshipCloudIncident,
  makeIdentityAlertIncident,
  makeRetirementIncident,
} from "./neighbourhoodAmbient";""",
)

# --------------------------------------------------------------- header doc + zones interface
cut(
    "/**\n * Build the voxel \"Claims Neighbourhood\" scene",
    "export interface NeighbourhoodResult {",
    """/**
 * Build the voxel Melbourne neighbourhood around Caldova Wealth — Client
 * Operations, as described in `docs/theme_neighhood.md`.
 *
 * The neighbourhood is the **starting point** of every request. It contains
 * five life-event zones, one per scripted client scenario:
 *
 *   - Docklands — new job (Priya: new account & super consolidation)
 *   - Airport   — overseas trip (Grace: identity-takeover attempt)
 *   - Oakleigh  — retirement (George: account-based pension)
 *   - Lygon St  — café closed (Tom: financial hardship release)
 *   - Box Hill  — family home (Robert: death benefit)
 *
 * The Caldova Wealth — Client Operations building sits at the centre as the
 * visual anchor. Roads connect every zone to the office door so clients
 * can be seen "heading to the office".
 *
 * The function is intentionally side-effect-only: it adds meshes to the
 * provided `scene`. All pieces are parented to a single root TransformNode
 * (returned) so callers can dispose them as a unit if needed.
 */
/**
 * Anchor points exported alongside the neighbourhood scene so the
 * scenario runner can place the client voxel character at the right
 * life-event zone, focus the camera there, and walk them along the path
 * toward the office front door.
 */
export interface IncidentZones {
  /** Position in front of the office door (where the route ends). */
  officeDoor: Vector3;
  /** Per-scenario life-event anchor (where the client spawns). */
  onboarding: Vector3;
  protection: Vector3;
  retirement: Vector3;
  hardship: Vector3;
  bereavement: Vector3;
}

""",
)
sub(
    "  /** Per-frame tick — drives ambient cars/people/pets and active incidents. */",
    "  /** Per-frame tick — drives ambient cars/people/pets and active life events. */",
)
sub(
    "  /** Play the scripted incident animation for the given scenario. */\n  playIncident(id: ScenarioId): void;\n  /** Stop any in-flight incident animation (e.g. on cancel). */",
    "  /** Play the scripted life-event animation for the given scenario. */\n  playIncident(id: ScenarioId): void;\n  /** Stop any in-flight life-event animation (e.g. on cancel). */",
)

# --------------------------------------------------------------- dash skip comments
sub("    if (x > -28 && x < -24) continue; // Cedar Way crossing", "    if (x > -28 && x < -24) continue; // Flinders Lane crossing")
sub("    if (x > 31 && x < 35) continue; // Oak Drive crossing", "    if (x > 31 && x < 35) continue; // Toorak Rd crossing")
sub("    if (z > -12 && z < -8) continue; // Birch Lane crossing", "    if (z > -12 && z < -8) continue; // Collins St crossing")
sub("    if (z > 18 && z < 22) continue; // Maple Crescent crossing", "    if (z > 18 && z < 22) continue; // Glenferrie Rd crossing")

# --------------------------------------------------------------- static vehicles
sub(
    """   * Build a properly-modelled static voxel vehicle (sedan or jeep) with
   * cabin, windscreen and four wheels — reusing the same mesh recipes as
   * the ambient traffic so static "highlight" cars (motor collision pair,
   * rental car, parked family car, investigator's sedan) read as real
   * vehicles instead of plain coloured boxes.""",
    """   * Build a properly-modelled static voxel vehicle (sedan, jeep or van)
   * with cabin, windscreen and wheels — reusing the same mesh recipes as
   * the ambient traffic so parked cars (Docklands kerbside, the family
   * car in Box Hill, the apartment resident's sedan) read as real
   * vehicles instead of plain coloured boxes.""",
)
sub(
    """    kind: "car" | "jeep" | "firetruck" | "van" | "towtruck",""",
    """    kind: "car" | "jeep" | "van",""",
)
sub(
    """    if (kind === "jeep") {
      buildJeepMeshes(scene, node, bodyHex, topHex);
    } else if (kind === "firetruck") {
      buildFireTruckMeshes(scene, node, bodyHex, topHex);
    } else if (kind === "van") {
      buildVanMeshes(scene, node, bodyHex, topHex);
    } else if (kind === "towtruck") {
      buildTowTruckMeshes(scene, node, bodyHex, topHex);
    } else {""",
    """    if (kind === "jeep") {
      buildJeepMeshes(scene, node, bodyHex, topHex);
    } else if (kind === "van") {
      buildVanMeshes(scene, node, bodyHex, topHex);
    } else {""",
)

# --------------------------------------------------------------- street sign auto-fit
sub(
    """  // A small wooden street sign at the corner of an intersection.
  const makeStreetSign = (""",
    """  // Shrink a bold font until `text` fits within `maxWidth` texture pixels.
  const fitFont = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startPx: number,
    minPx = 24,
  ): void => {
    let px = startPx;
    ctx.font = `bold ${px}px sans-serif`;
    while (ctx.measureText(text).width > maxWidth && px > minPx) {
      px -= 2;
      ctx.font = `bold ${px}px sans-serif`;
    }
  };

  // A small street-name sign at the corner of an intersection.
  const makeStreetSign = (""",
)
sub(
    """    c.fillStyle = "#ffffff";
    c.font = "bold 48px sans-serif";
    c.textBaseline = "middle";
    c.textAlign = "center";
    c.fillText(text, 256, 50);""",
    """    c.fillStyle = "#ffffff";
    fitFont(c, text, 470, 48);
    c.textBaseline = "middle";
    c.textAlign = "center";
    c.fillText(text, 256, 50);""",
)

# --------------------------------------------------------------- makePerson default palette
sub(
    """  // customer in the neighbourhood looks identical to the same persona
  // when they arrive at the office reception. `paletteKey` selects one
  // of the entries in `PALETTES` (e.g. "customerHome", "intakeOfficer").
  const makePerson = (
    x: number,
    z: number,
    paletteKey: keyof typeof PALETTES = "customerHome",""",
    """  // client in the neighbourhood looks identical to the same persona
  // when they arrive at the office reception. `paletteKey` selects one
  // of the entries in `PALETTES` (e.g. "customerRetirement", "onboardingOfficer").
  const makePerson = (
    x: number,
    z: number,
    paletteKey: keyof typeof PALETTES = "cityCommuter",""",
)

# --------------------------------------------------------------- life-event marker
cut(
    "  // Incident marker — a floating \"!\" bubble above an incident.",
    "  // A small map-pin label that sits above a zone.",
    """  // Life-event marker — a floating glyph bubble above each zone. Only the
  // identity-takeover alert carries a "!" — the other life events are
  // milestones, not alarms.
  const makeIncidentMarker = (
    x: number,
    y: number,
    z: number,
    icon: "briefcase" | "shield" | "party" | "handshake" | "heart",
  ): void => {
    const bubble = MeshBuilder.CreateBox(
      `nh_marker_${x}_${z}`,
      { width: 0.9, height: 0.9, depth: 0.18 },
      scene,
    );
    bubble.position = new Vector3(x, y, z);
    attach(bubble);

    const tex = new DynamicTexture(
      `nh_marker_tex_${x}_${z}`,
      { width: 128, height: 128 },
      scene,
      false,
    );
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#fff5d6";
    ctx.fillRect(0, 0, 128, 128);

    const symbols: Record<typeof icon, { color: string; glyph: string; alert?: boolean }> = {
      briefcase: { color: "#3a8fd6", glyph: "💼" },
      shield: { color: "#d9534f", glyph: "🛡️", alert: true },
      party: { color: "#e8a33d", glyph: "🎉" },
      handshake: { color: "#e07a2c", glyph: "🤝" },
      heart: { color: "#c2566f", glyph: "♥" },
    };
    const sym = symbols[icon];
    ctx.fillStyle = sym.color;
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sym.glyph, 64, sym.alert ? 70 : 66);
    if (sym.alert) {
      // exclamation mark above
      ctx.fillStyle = "#1c2230";
      ctx.font = "bold 38px sans-serif";
      ctx.fillText("!", 64, 22);
    }
    tex.update();

    const faceMat = new StandardMaterial(`nh_marker_face_${x}_${z}`, scene);
    faceMat.diffuseTexture = tex;
    faceMat.emissiveColor = new Color3(0.6, 0.6, 0.6);
    faceMat.specularColor = new Color3(0, 0, 0);
    bubble.material = faceMat;
  };

""",
)

# --------------------------------------------------------------- path line (disabled) + construction comment
cut(
    "  // A subtle dashed path line tracing a customer's route from an incident",
    "  // ----- Construction-pack-style prop builders -----",
    "",
)
sub(
    """  // generic MagicaVoxel construction packs (chunky steel poles, striped
  // barriers, traffic cones, timber/brick stacks, cement mixer, small
  // crane). They give the scene a builder/repair vibe to match scenarios
  // 3 (home rebuild) and 4 (cafe rebuild).""",
    """  // generic MagicaVoxel construction packs (striped barriers, traffic
  // cones, timber/brick stacks, cement mixer, tipper truck). They dress the
  // builder's yard and the roadworks on the east side of town.""",
)
# Scaffold, crane and skip were only used by the old repair scenes.
cut(
    "  // Scaffolding frame around (cx, cz) with given footprint width/depth.",
    "  // Builder's tipper truck — cab + open tipping bin with a load of gravel.",
    "",
)
cut(
    "  // Skip / construction dumpster.",
    "  // ----- Side streets, sidewalks, and crossings -----",
    "",
)

# --------------------------------------------------------------- street names
cut(
    "  // Maple Crescent — east-west residential street running through the",
    "  makeRoad(\"nh_road_maple\", 48, 3.5, new Vector3(10, 0.05, 20));",
    """  // Glenferrie Rd — east-west residential street running through the
  // northern half, in front of George's place in Oakleigh. Extended west
  // across the main vertical road (now reaches x≈-14) so the upper
  // neighbourhood is no longer split in two. Stops short of the airport
  // terminal (x≈-16) so it doesn't slice through that building.
""",
)
sub("  // Side kerbs (sidewalks) along Maple Crescent.", "  // Side kerbs (sidewalks) along Glenferrie Rd.")
cut(
    "  // Birch Lane — east-west street serving the southern apartment / civic",
    "  makeRoad(\"nh_road_birch\", 66, 3.5, new Vector3(5, 0.05, -10));",
    """  // Collins St — the long east-west tram street across the south of the
  // map, between the central road and Lygon St. Tram tracks run down the
  // middle instead of a painted centre line.
""",
)
sub(
    """  sideRoadDash("nh_dash_birch", "x", -10, -26, 36);
""",
    """  makeBox("nh_tram_rail_n", 66, 0.03, 0.08, new Vector3(5, 0.095, -9.6), "#8a8d94");
  makeBox("nh_tram_rail_s", 66, 0.03, 0.08, new Vector3(5, 0.095, -10.4), "#8a8d94");
""",
)
cut(
    "  // Oak Drive — north-south street on the east side, connecting Maple",
    "  makeRoad(\"nh_road_oak\", 3.5, 28, new Vector3(33, 0.05, 8));",
    """  // Toorak Rd — north-south street on the east side, connecting
  // Glenferrie Rd to the main road. Placed at x=33 so it sits clear of the
  // Docklands fintech HQ at x≈23-29.
""",
)
cut(
    "  // Cedar Way — short north-south street west of the office, linking the",
    "  makeRoad(\"nh_road_cedar\", 3.5, 22, new Vector3(-26, 0.05, 8));",
    """  // Flinders Lane — short north-south street west of the office, linking
  // the airport to the main road.
""",
)
sub(
    """  makeStreetSign(7.0, 22.5, "MAPLE CRESCENT", "#3a8fd6");
  makeStreetSign(7.0, -12.5, "BIRCH LANE", "#5a8a4a");
  makeStreetSign(36.5, 6.0, "OAK DRIVE", "#c44a3a");
  makeStreetSign(-29.5, 6.0, "CEDAR WAY", "#7a4f9c");""",
    """  makeStreetSign(7.0, 22.5, "GLENFERRIE RD", "#3a8fd6");
  makeStreetSign(7.0, -12.5, "COLLINS ST", "#5a8a4a");
  makeStreetSign(36.5, 6.0, "TOORAK RD", "#c44a3a");
  makeStreetSign(-29.5, 6.0, "FLINDERS LANE", "#7a4f9c");""",
)
cut(
    "  // Willow Avenue — new south-side east-west connector at z=-22. Threads",
    "  makeRoad(\"nh_road_willow\", 48, 3.5, new Vector3(8, 0.05, -22));",
    """  // Chapel St — south-side east-west connector at z=-22. Threads between
  // the south-west mid-rise cluster, the apartment block, and the
  // builder's yard so those outlying lots are no longer dead-ended.
""",
)
sub('  makeStreetSign(-15.0, -19.0, "WILLOW AVENUE", "#5a8a4a");', '  makeStreetSign(-15.0, -19.0, "CHAPEL ST", "#5a8a4a");')
cut(
    "  // Elm Court — short north-south spur at x=22 linking the east end of",
    "  makeRoad(\"nh_road_elm\", 3.5, 14, new Vector3(22, 0.05, -16));",
    """  // Swan St — short north-south spur at x=22 linking Collins St (z=-10)
  // to Chapel St (z=-22), down to the builder's yard end of town.
""",
)
# Corner signs for the two spurs sit on Collins St's south kerb, clear of
# the tram running down the middle of the street.
sub('  makeStreetSign(25.0, -10.5, "ELM COURT", "#7a4a3a");', '  makeStreetSign(24.6, -12.0, "SWAN ST", "#7a4a3a");')
cut(
    "  // Pine Court — short north-south spur at x=-10 linking Birch Lane",
    "  makeRoad(\"nh_road_pine\", 3.5, 12, new Vector3(-10, 0.05, -16));",
    """  // Lygon St — short north-south spur at x=-10 linking Collins St (z=-10)
  // down to Chapel St (z=-22), past Tom's old café.
""",
)
sub('  makeStreetSign(-13.0, -10.5, "PINE COURT", "#3a5fb0");', '  makeStreetSign(-12.4, -12.0, "LYGON ST", "#3a5fb0");')
sub(
    """  // Maple Crescent (north side, facing south onto the street). The""",
    """  // Glenferrie Rd (north side, facing south onto the street). The""",
)
sub(
    """  // (The previous "Maple back row" silhouettes used to sit on z=17.6 but
  // that band overlaps both the south kerb of Maple Crescent and the
  // back of the residential zone 1 houses at z=14, so the row has been
  // removed in favour of clean grass between the two streets.)""",
    """  // (A previous back row of silhouettes used to sit on z=17.6 but that
  // band overlaps both the south kerb of Glenferrie Rd and the back of the
  // Oakleigh houses at z=14, so it was removed in favour of clean grass.)""",
)
sub(
    """  // Birch Lane (north side, facing south). Houses are now placed clear""",
    """  // Collins St (north side, facing south). Houses are now placed clear""",
)
sub(
    """  // Oak Drive (east side, facing west — built as a custom rotated frame).""",
    """  // Toorak Rd (east side, facing west — built as a custom rotated frame).""",
)

# --------------------------------------------------------------- central office
sub(
    """  // ----- Zava Insurance Claims Office (central anchor) -----""",
    """  // ----- Caldova Wealth — Client Operations (central anchor) -----""",
)
sub(
    """  sctx.fillStyle = "#1c2230";
  sctx.font = "bold 110px sans-serif";
  sctx.textBaseline = "middle";
  sctx.fillText("Z", 70, 105);
  sctx.fillStyle = "#ffffff";
  sctx.font = "bold 90px sans-serif";
  sctx.fillText("ZAVA Claims", 200, 110);
  signTex.update();""",
    """  sctx.fillStyle = "#1c2230";
  sctx.font = "bold 110px sans-serif";
  sctx.textBaseline = "middle";
  sctx.textAlign = "center";
  sctx.fillText("C", 90, 106);
  sctx.textAlign = "left";
  // "CALDOVA" in bold white with "Wealth" in the brand amber, shrunk
  // together if needed so the pair always fits beside the logo tile.
  let brandPx = 92;
  const brandWidth = (): number => {
    sctx.font = `bold ${brandPx}px sans-serif`;
    const w1 = sctx.measureText("CALDOVA ").width;
    sctx.font = `600 ${Math.round(brandPx * 0.85)}px sans-serif`;
    return w1 + sctx.measureText("Wealth").width;
  };
  while (brandWidth() > 790 && brandPx > 50) brandPx -= 2;
  sctx.fillStyle = "#ffffff";
  sctx.font = `bold ${brandPx}px sans-serif`;
  sctx.fillText("CALDOVA", 196, 110);
  const caldovaWidth = sctx.measureText("CALDOVA ").width;
  sctx.fillStyle = "#ffd166";
  sctx.font = `600 ${Math.round(brandPx * 0.85)}px sans-serif`;
  sctx.fillText("Wealth", 196 + caldovaWidth, 112);
  signTex.update();""",
)
sub(
    """  // Office label
  makeLabel(-10, 13, "Zava Insurance Claims Office", "#2a3a5c");""",
    """  // Office label
  makeLabel(-10, 13, "Caldova Wealth — Client Operations", "#2a3a5c");""",
)

# --------------------------------------------------------------- zones (captures through zone 6)
zones = pathlib.Path(".tmp-convert/nh_zones.ts").read_text(encoding="utf-8")
cut(
    "  // ----- Captures: scenery meshes referenced by incident animations -----",
    "  // ----- Voxel-city downtown strip -----",
    zones,
)

# --------------------------------------------------------------- builder's yard + lamps + trail
sub(
    """  // A small construction-supplies depot on the eastern edge — visually
  // ties the construction-pack-style props together and reinforces the
  // "claims lead to repairs" narrative.""",
    """  // A small construction-supplies depot on the eastern edge — everyday
  // scenery that ties the construction-pack-style props together.""",
)
sub(
    """  // South-central playground — between Pine Court and Elm Court on Willow Ave""",
    """  // South-central playground — between Lygon St and Swan St on Chapel St""",
)
sub(
    """  // North-back river — winding strip along the back of the map between the
  // travel hub and the Maple Crescent skyline. Pure scenery; no road""",
    """  // North-back river — winding strip along the back of the map between the
  // airport and the Glenferrie Rd skyline. Pure scenery; no road""",
)
sub(
    """  // mid-rises and Cedar Way.""",
    """  // mid-rises and Flinders Lane.""",
)
sub(
    """    // West side, between Cedar Way and the main road.""",
    """    // West side, between Flinders Lane and the main road.""",
)
sub(
    """    // North-east, on Maple Crescent (a two-storey home). Centre Z lifted""",
    """    // North-east, on Glenferrie Rd (a two-storey home). Centre Z lifted""",
)
sub(
    """    // Lamp in front of the Zava Claims office shifted left by 10 units""",
    """    // Lamp in front of the Caldova office shifted left by 10 units""",
)
sub(
    """  // Decorative customer trail: a few people on streets heading to office -----
  // The Zava Insurance Claims Office building sits at world (-10, 0, 8) with
  // its south-facing entrance at z≈4. Trail figures face that doorway so the
  // visual reads as "everyone heading into the Zava Claims building".
  const office = { x: -10, z: 4 };
  makePerson(0, -10, "intakeOfficer", office);
  makePerson(8, -2, "supplierCoord", office);
  makePerson(-3, 6, "claimsAssessor", office);
  makePerson(-2, -3, "lossAdjuster", office);
  // Extra figures along the new side streets to make the suburb feel lived-in.
  makePerson(18, 20, "commsSpecialist", office);
  makePerson(26, 16, "settlementOfficer", office);
  makePerson(-12, -19, "fraudInvestigator", office);
  makePerson(30, 6, "teamLeader", office);""",
    """  // Decorative trail: Caldova staff out and about, heading to the office ---
  // The Caldova Wealth — Client Operations building sits at world (-10, 0, 8)
  // with its south-facing entrance at z≈4. Trail figures face that doorway
  // so the visual reads as "everyone heading into the Caldova building".
  const office = { x: -10, z: 4 };
  makePerson(-4.2, -7, "onboardingOfficer", office);
  makePerson(8, -2, "transfersCoord", office);
  makePerson(-3, 6, "benefitsAssessor", office);
  makePerson(-2, -3, "investmentAnalyst", office);
  // Extra figures along the side streets to make the suburb feel lived-in.
  makePerson(18, 20, "commsSpecialist", office);
  makePerson(26, 16, "paymentsOfficer", office);
  makePerson(-12, -19, "finCrimeInvestigator", office);
  makePerson(30, 6, "teamLeader", office);""",
)

# --------------------------------------------------------------- zones object
cut(
    "  const zones: IncidentZones = {",
    "  // ----- Ambient life: cars, pedestrians, pets, and incident animations -----",
    """  const zones: IncidentZones = {
    // Office front door — the Caldova Wealth — Client Operations building
    // sits at world (-10, 0, 8) with its south-facing entrance at z≈4.
    // Routing the client to (-10, 0, 5) puts them at the doorway threshold,
    // so the last walk segment visibly carries them up the office walkway
    // and INTO the building before the scene fades to the office.
    officeDoor: new Vector3(-10, 0, 5),
    // Each zone anchor is where the client voxel character begins their
    // walk toward the office — on a path or forecourt beside the life-event
    // scenery rather than inside a building.
    onboarding: new Vector3(24.5, 0, 4.4),
    protection: new Vector3(-32 + 8, 0, 18 - 4),
    retirement: new Vector3(16 - 2, 0, 14 - 4),
    hardship: new Vector3(-18 + 1, 0, -14 + 2),
    bereavement: new Vector3(16 - 1, 0, -16 + 2),
  };

""",
)
sub(
    """  // ----- Ambient life: cars, pedestrians, pets, and incident animations -----
  // Mirrors the "always animated" feel of the office scene, where staff and
  // customers are constantly moving around. Routes are picked to avoid the
  // static incident scenery (parked cars, smashed bumpers, plumber van etc.).""",
    """  // ----- Ambient life: trams, cars, pedestrians, pets, and life events -----
  // Mirrors the "always animated" feel of the office scene, where staff and
  // clients are constantly moving around. Routes are picked to avoid the
  // static scenery (parked cars, street signs, shopfront boards etc.).""",
)

# --------------------------------------------------------------- ambient traffic
sub(
    """  // Maple Crescent (z=20) — runs east-west; lanes at z=19 (eastbound) and z=21 (westbound).""",
    """  // Glenferrie Rd (z=20) — runs east-west; lanes at z=19 (eastbound) and z=21 (westbound).""",
)
sub(
    """  // Birch Lane (z=-10) — east-west. Eastbound lane only to keep clear of the
  // apartment block / café approach.
  ambient.addCar(
    "birch_e",
    [
      [-26, -11],
      [6, -11],
    ],
    { type: "sedan", bodyColor: "#ffd166", topColor: "#c4a14a", speed: 4.2 },
  );
  // Oak Drive (x=33) — north-south, avoiding the motor incident at x=22.""",
    """  // Collins St (z=-10) — a green-and-gold Melbourne tram glides along the
  // tracks down the middle of the street.
  ambient.addCar(
    "collins_tram",
    [
      [-27, -10],
      [37, -10],
    ],
    { type: "tram", bodyColor: "#2f7d3a", topColor: "#e8b84a", speed: 3.2 },
  );
  // Toorak Rd (x=33) — north-south on the east side of town.""",
)
sub(
    """  // Cedar Way (x=-26) — north-south on the west side.""",
    """  // Flinders Lane (x=-26) — north-south on the west side.""",
)
sub(
    """  ambient.addCar(
    "birch_bike_w",
    [
      [6, -9],
      [-26, -9],
    ],
    { type: "bicycle", bodyColor: "#4a8a4a", topColor: "#ffd166", speed: 2.4 },
  );""",
    """  ambient.addCar(
    "collins_bike_w",
    [
      [6, -8.8],
      [-26, -8.8],
    ],
    { type: "bicycle", bodyColor: "#4a8a4a", topColor: "#ffd166", speed: 2.4 },
  );

  // Delivery vans doing the rounds on Toorak Rd and Chapel St.
  ambient.addCar(
    "toorak_van",
    [
      [32, 20],
      [32, -4],
    ],
    { type: "van", bodyColor: "#f4f0e6", topColor: "#d9534f", speed: 3.6 },
  );
  ambient.addCar(
    "chapel_van",
    [
      [-15, -21.2],
      [31, -21.2],
    ],
    { type: "van", bodyColor: "#ffd166", topColor: "#3a3a44", speed: 3.8 },
  );""",
)

# --------------------------------------------------------------- pedestrians
sub('    "main_n_walker",\n    "customerContents",', '    "main_n_walker",\n    "cityCommuter",')
sub('    "main_s_walker",\n    "customerHome",', '    "main_s_walker",\n    "cityJogger",')
sub('    "maple_walker",\n    "customerBusiness",', '    "maple_walker",\n    "cityStudent",')
sub('    "vert_walker",\n    "customerTravel",', '    "vert_walker",\n    "parcelCourier",')
sub(
    """  // Friendly pets bumbling around grass patches well clear of the roads
  // and incident scenery (corners of the map are mostly empty grass). A""",
    """  // Friendly pets bumbling around grass patches well clear of the roads
  // and life-event scenery (corners of the map are mostly empty grass). A""",
)

# --------------------------------------------------------------- incident registration
registration = pathlib.Path(".tmp-convert/nh_register.ts").read_text(encoding="utf-8")
cut(
    "  // Ambient roadworks: a busted water main on the grass verge between",
    "  return {\n    root,\n    zones,",
    registration,
)

p.write_text(t, encoding="utf-8", newline="\r\n")
print("neighbourhoodScene.ts converted")
