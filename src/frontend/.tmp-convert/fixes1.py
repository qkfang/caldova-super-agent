import pathlib

def sub(path, pairs):
    p = pathlib.Path(path)
    t = p.read_text(encoding="utf-8")
    for old, new in pairs:
        n = t.count(old)
        if n != 1:
            raise SystemExit(f"{path}: expected 1 match, found {n}: {old[:80]!r}")
        t = t.replace(old, new)
    p.write_text(t, encoding="utf-8", newline="\r\n")
    print("ok", path)

sub("src/neighbourhoodScene.ts", [
    # makeLabel: optional sign height so labels can float above tall roofs.
    (
        """  // A small map-pin label that sits above a zone.
  const makeLabel = (
    x: number,
    z: number,
    text: string,
    color = "#1c2230",
  ): void => {""",
        """  // A small map-pin label that sits above a zone. `signY` lifts the sign
  // (and lengthens its pole) for labels that must clear a tall roof.
  const makeLabel = (
    x: number,
    z: number,
    text: string,
    color = "#1c2230",
    signY = 5.6,
  ): void => {""",
    ),
    (
        """    sign.position = new Vector3(x, 5.6, z);
    // Rotate around Y so the sign faces the camera, then tilt the top""",
        """    sign.position = new Vector3(x, signY, z);
    // Rotate around Y so the sign faces the camera, then tilt the top""",
    ),
    (
        """      `nh_label_pole_${x}_${z}`,
      { width: 0.18, height: 5.0, depth: 0.18 },
      scene,
    );
    pole.position = new Vector3(x, 2.5, z);""",
        """      `nh_label_pole_${x}_${z}`,
      { width: 0.18, height: signY - 0.6, depth: 0.18 },
      scene,
    );
    pole.position = new Vector3(x, (signY - 0.6) / 2, z);""",
    ),
    # Office label floats above the office roof so it isn't hidden behind it.
    (
        """  makeLabel(-10, 13, "Caldova Wealth — Client Operations", "#2a3a5c");""",
        """  makeLabel(-10, 8, "Caldova Wealth — Client Operations", "#2a3a5c", 9.4);""",
    ),
    # Docklands label floats above the HQ roof instead of blocking its entrance.
    (
        """    makeLabel(zx + 3, zz + 4, "Docklands — New Job (Priya)", "#3a8fd6");""",
        """    makeLabel(zx + 4, zz + 8, "Docklands — New Job (Priya)", "#3a8fd6", 7.4);""",
    ),
    # Airport: props out in front of the terminal (they used to sit inside
    # its footprint), and the alert centred where Grace sets off.
    (
        """    // Baggage trolley stacked with suitcases, ready for departure
    makeBox("nh_lug_trolley", 2.4, 0.3, 1.0, new Vector3(zx + 2, 0.25, zz - 1.5), "#7a7a7a");
    makeBox("nh_lug_case1", 0.8, 0.5, 0.6, new Vector3(zx + 2.8, 0.65, zz - 1.5), "#b03a6f");
    makeBox("nh_lug_case2", 0.8, 0.5, 0.6, new Vector3(zx + 2.0, 0.65, zz - 1.5), "#3a6dc4");
    makeBox("nh_lug_case3", 0.8, 0.5, 0.6, new Vector3(zx + 1.2, 0.65, zz - 1.5), "#5a8a4a");

    // Grace with her phone, about to fly out
    makePerson(zx + 1, zz - 0.5, "customerProtection", { x: -10, z: 4 });
    graceAlertAt = new Vector3(zx + 1, 0, zz - 0.5);

    // Shield marker (🛡️) — her account is being protected
    makeIncidentMarker(zx + 2, 2.4, zz - 1.5, "shield");""",
        """    // Baggage trolley stacked with suitcases on the apron, ready for
    // departure (kept clear of the terminal footprint, z ≥ zz - 2.5).
    makeBox("nh_lug_trolley", 2.4, 0.3, 1.0, new Vector3(zx + 2.6, 0.25, zz - 3.8), "#7a7a7a");
    makeBox("nh_lug_case1", 0.8, 0.5, 0.6, new Vector3(zx + 3.4, 0.65, zz - 3.8), "#b03a6f");
    makeBox("nh_lug_case2", 0.8, 0.5, 0.6, new Vector3(zx + 2.6, 0.65, zz - 3.8), "#3a6dc4");
    makeBox("nh_lug_case3", 0.8, 0.5, 0.6, new Vector3(zx + 1.8, 0.65, zz - 3.8), "#5a8a4a");

    // Grace at the departures door with her phone, about to fly out
    makePerson(zx + 2.6, zz - 3.0, "customerProtection", { x: -10, z: 4 });
    // The alert pulses around the spot where she sets off for the office.
    graceAlertAt = new Vector3(zx + 8, 0, zz - 4);

    // Shield marker (🛡️) — her account is being protected
    makeIncidentMarker(zx + 2.6, 2.6, zz - 3.8, "shield");""",
    ),
])

sub("src/neighbourhoodAmbient.ts", [
    (
        """  cloudMat.diffuseColor = Color3.FromHexString("#9aa0a8");
  cloudMat.emissiveColor = Color3.FromHexString("#5a6068");""",
        """  cloudMat.diffuseColor = Color3.FromHexString("#80868f");
  cloudMat.emissiveColor = Color3.FromHexString("#40454d");""",
    ),
])

sub("src/styles.css", [
    (
        """.agent-card .status {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 999px;""",
        """.agent-card .status {
  font-size: 9px;
  padding: 2px 6px;
  /* Cap the pill so long status lines wrap instead of squeezing the
     staff name and role column. */
  max-width: 128px;
  text-align: center;
  line-height: 1.25;
  border-radius: 10px;""",
    ),
])
