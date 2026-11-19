import pathlib

p = pathlib.Path("src/neighbourhoodAmbient.ts")
t = p.read_text(encoding="utf-8")
tram = pathlib.Path(".tmp-convert/tram.ts").read_text(encoding="utf-8")
incidents = pathlib.Path(".tmp-convert/incidents.ts").read_text(encoding="utf-8")


def cut(text: str, start_marker: str, end_marker: str, replacement: str = "") -> str:
    """Replace text[start:end) where start is start_marker and end is end_marker."""
    if text.count(start_marker) != 1:
        raise SystemExit(f"start marker count != 1: {start_marker[:60]!r}")
    s = text.index(start_marker)
    e = text.index(end_marker, s)
    return text[:s] + replacement + text[e:]


def sub(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"expected 1 match: {old[:70]!r} (found {text.count(old)})")
    return text.replace(old, new)


# 1. Drop the fire truck builder.
t = cut(
    t,
    "/**\n * Build a chunky voxel fire truck:",
    "/**\n * Build a chunky voxel panel van:",
)
# 2. Replace the tow truck builder with the Melbourne tram.
t = cut(
    t,
    "/**\n * Build a chunky voxel flatbed tow truck:",
    "/**\n * Build a stubby voxel Mini Cooper-style hatchback:",
    tram,
)
# 3. Drop the always-on busted-pipeline roadworks scene.
t = cut(
    t,
    '  /**\n   * Spawn a "busted pipeline" roadworks scene',
    "  /**\n   * Register a free-running ambient animation",
)
# 4. Replace the old insurance incident factories with life-event ones.
t = cut(
    t,
    "/* ------------------------------------------------------------------------ */\n/* Incident animation factories ",
    "/**\n * Calm life-insurance scene:",
    incidents,
)

# 5. Smaller wording / type updates.
t = sub(
    t,
    "import {\n  Color3,\n  Mesh,\n",
    "import {\n  Color3,\n  DynamicTexture,\n  Mesh,\n",
)
t = sub(
    t,
    " * A scripted incident animation tied to a customer scenario.",
    " * A scripted life-event animation tied to a client scenario.",
)
t = sub(
    t,
    "export type VehicleType =\n  | \"sedan\"\n  | \"jeep\"\n  | \"mini\"\n  | \"bicycle\"\n  | \"scooter\";",
    "export type VehicleType =\n  | \"sedan\"\n  | \"jeep\"\n  | \"mini\"\n  | \"bicycle\"\n  | \"scooter\"\n  | \"van\"\n  | \"tram\";",
)
t = sub(
    t,
    "    case \"scooter\":\n      buildScooterMeshes(scene, parent, bodyHex, topHex);\n      return;\n",
    "    case \"scooter\":\n      buildScooterMeshes(scene, parent, bodyHex, topHex);\n      return;\n"
    "    case \"van\":\n      buildVanMeshes(scene, parent, bodyHex, topHex);\n      return;\n"
    "    case \"tram\":\n      buildTramMeshes(scene, parent, bodyHex, topHex);\n      return;\n",
)
t = sub(
    t,
    " * and per-scenario incident animations (e.g. the burst-pipe water\n * spurt).",
    " * and per-scenario life-event animations (e.g. the retirement\n * confetti).",
) if " * and per-scenario incident animations (e.g. the burst-pipe water\n * spurt)." in t else t
t = sub(
    t,
    "   * route. Defaults to a sedan; pass `type` for a jeep, mini cooper,\n   * bicycle, or scooter so a row of ambient traffic feels varied. The",
    "   * route. Defaults to a sedan; pass `type` for a jeep, mini cooper,\n   * bicycle, scooter, delivery van or tram so ambient traffic feels\n   * varied. The",
)
t = sub(
    t,
    "   * Useful for permanent props that should always be alive (e.g. the\n   * café rooftop fire flicker and rising smoke wisps), as opposed to",
    "   * Useful for permanent props that should always be alive (e.g. the\n   * retirement balloons bobbing in the breeze), as opposed to",
)
t = sub(
    t,
    "/**\n * Calm life-insurance scene: a soft warm halo gently fades in and out\n * around the home, signalling that this scenario is handled with care\n * (no alarm or chaos).",
    "/**\n * Bereavement: a soft warm halo gently fades in and out around the\n * family home, signalling that this case is handled with care (no alarm\n * or chaos).",
)

p.write_text(t, encoding="utf-8", newline="\r\n")
print("neighbourhoodAmbient.ts restructured")
