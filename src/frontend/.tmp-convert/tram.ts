/**
 * Build a Melbourne-style voxel tram: a long green body with a gold window
 * band, a roof pantograph, glowing destination boards at both ends and two
 * bogies underneath. Long axis runs along local +Z (like the other
 * vehicles); at ~6.4 units it's the longest vehicle in the neighbourhood.
 */
export function buildTramMeshes(
  scene: Scene,
  parent: TransformNode,
  bodyHex: string,
  topHex: string,
): void {
  const mat = (suffix: string, hex: string, glow = 0): StandardMaterial => {
    const m = new StandardMaterial(`${parent.name}_${suffix}_mat`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.05, 0.05, 0.05);
    if (glow > 0) m.emissiveColor = Color3.FromHexString(hex).scale(glow);
    return m;
  };
  const box = (
    suffix: string,
    w: number,
    h: number,
    d: number,
    pos: Vector3,
    material: StandardMaterial,
  ): Mesh => {
    const b = MeshBuilder.CreateBox(
      `${parent.name}_${suffix}`,
      { width: w, height: h, depth: d },
      scene,
    );
    b.parent = parent;
    b.position = pos;
    b.material = material;
    return b;
  };
  const bodyMat = mat("body", bodyHex);
  const bandMat = mat("band", topHex);
  const winMat = mat("win", "#cfe7ff");
  const darkMat = mat("dark", "#1c2230");
  const signMat = mat("sign", "#ffb347", 0.6);

  // Green lower body, gold window band and a green roof cap.
  box("lower", 1.5, 0.75, 6.4, new Vector3(0, 0.62, 0), bodyMat);
  box("band", 1.52, 0.7, 6.2, new Vector3(0, 1.34, 0), bandMat);
  box("roof", 1.4, 0.18, 6.3, new Vector3(0, 1.78, 0), bodyMat);
  // Window strip along both sides plus a windscreen at each end.
  box("windows", 1.54, 0.42, 5.4, new Vector3(0, 1.36, 0), winMat);
  box("screenF", 1.3, 0.45, 0.06, new Vector3(0, 1.36, 3.12), winMat);
  box("screenB", 1.3, 0.45, 0.06, new Vector3(0, 1.36, -3.12), winMat);
  // Destination boards above the windscreens.
  box("destF", 1.0, 0.2, 0.06, new Vector3(0, 1.62, 3.13), signMat);
  box("destB", 1.0, 0.2, 0.06, new Vector3(0, 1.62, -3.13), signMat);
  // Bumpers.
  box("bumpF", 1.3, 0.18, 0.12, new Vector3(0, 0.36, 3.24), darkMat);
  box("bumpB", 1.3, 0.18, 0.12, new Vector3(0, 0.36, -3.24), darkMat);
  // Pantograph: base plate, angled arm and the contact shoe on top.
  box("pantoBase", 0.6, 0.1, 0.6, new Vector3(0, 1.92, 0), darkMat);
  const arm = box("pantoArm", 0.08, 0.9, 0.08, new Vector3(0, 2.3, 0.2), darkMat);
  arm.rotation.x = 0.5;
  box("pantoShoe", 0.9, 0.06, 0.12, new Vector3(0, 2.72, 0.42), darkMat);
  // Two bogies underneath.
  for (const dz of [-2.1, 2.1]) {
    box(`bogie_${dz}`, 1.2, 0.3, 1.2, new Vector3(0, 0.15, dz), darkMat);
  }
}

