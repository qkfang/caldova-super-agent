  // ----- Captures: scenery referenced by the life-event animations -----
  // These are populated as each zone is built below, then handed to the
  // ambient controller at the very end so each scenario can replay its
  // life-event animation when started.
  let retirementBanner: Mesh | null = null;
  let retirementConfettiAt: Vector3 | null = null;
  const retirementBalloons: Mesh[] = [];
  let newJobConfettiAt: Vector3 | null = null;
  let cafeCloudAt: Vector3 | null = null;
  let cafeFrontAt: Vector3 | null = null;
  let graceAlertAt: Vector3 | null = null;
  let familyHomeCenter: Vector3 | null = null;

  // A flat box sign with centred, auto-fitted text on its front face.
  const makeTextSign = (
    name: string,
    w: number,
    h: number,
    pos: Vector3,
    text: string,
    opts: { bg: string; fg: string; texW?: number; texH?: number; fontPx?: number },
  ): Mesh => {
    const sign = MeshBuilder.CreateBox(name, { width: w, height: h, depth: 0.08 }, scene);
    sign.position = pos;
    attach(sign);
    const texW = opts.texW ?? 512;
    const texH = opts.texH ?? 96;
    const tex = new DynamicTexture(`${name}_tex`, { width: texW, height: texH }, scene, false);
    const c = tex.getContext() as CanvasRenderingContext2D;
    c.fillStyle = opts.bg;
    c.fillRect(0, 0, texW, texH);
    c.fillStyle = opts.fg;
    fitFont(c, text, texW * 0.9, opts.fontPx ?? Math.round(texH * 0.55));
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, texW / 2, texH / 2 + 2);
    tex.update();
    const m = new StandardMaterial(`${name}_mat`, scene);
    m.diffuseTexture = tex;
    m.emissiveColor = new Color3(0.5, 0.5, 0.5);
    m.specularColor = new Color3(0, 0, 0);
    sign.material = m;
    return sign;
  };

  // ----- Zone 1: Oakleigh — Retirement (George) -----
  // North-east quadrant. George's family home is dressed for his
  // retirement: a "Happy Retirement" banner across the front wall and
  // balloons tied to the front fence.
  {
    const zx = 16;
    const zz = 14;

    // George's house — full suburban look: foundation, mullioned windows,
    // chimney, pitched gable roof, picket fence, front path.
    makeBox("nh_home_h1_found", 5.4, 0.4, 4.4, new Vector3(zx, 0.2, zz), "#9a8f7a");
    makeBox("nh_home_h1_base", 5, 2.6, 4, new Vector3(zx, 1.7, zz), "#e7c8a0");
    makeBox(
      "nh_home_h1_trim",
      5.2,
      0.18,
      4.2,
      new Vector3(zx, 2.91, zz),
      "#f4f0e6",
    );
    makeGableRoof("nh_home_h1_roof", 4.8, 4, zx, zz, 3.0, "#b04a3a", "#f4f0e6");
    makeChimney(zx + 1.4, zz + 0.6, 3.4, "#a23a2c");
    makeBox("nh_home_h1_door", 0.95, 1.7, 0.16, new Vector3(zx, 0.85, zz - 2.05), "#5a3a22");
    makeBox("nh_home_h1_step", 1.4, 0.16, 0.5, new Vector3(zx, 0.5, zz - 2.3), "#cfc8b4");
    makeMullionedWindow("nh_home_h1_winL", zx - 1.55, 1.7, zz - 2.0, 1.0, 0.85, "south");
    makeMullionedWindow("nh_home_h1_winR", zx + 1.55, 1.7, zz - 2.0, 1.0, 0.85, "south");
    makeMullionedWindow("nh_home_h1_winE", zx + 2.5, 1.7, zz, 0.9, 0.85, "east");
    // Garden / driveway
    makeBox("nh_home_h1_drive", 2.4, 0.05, 3, new Vector3(zx, 0.06, zz - 4), "#b8b0a0");
    makeFrontPath("nh_home_h1_path", zx, zz - 2.6, zx, zz - 5.4);
    makePicketFence(zx - 3.0, zx - 1.2, zz - 5.6);
    makePicketFence(zx + 1.2, zx + 3.0, zz - 5.6);
    makeMailbox(zx + 2.6, zz - 5.3);

    // "HAPPY RETIREMENT, GEORGE!" banner across the front wall, between
    // the windows and the eaves, with a strip of bunting along the top.
    const banner = MeshBuilder.CreateBox(
      "nh_retire_banner",
      { width: 4.6, height: 0.55, depth: 0.06 },
      scene,
    );
    banner.position = new Vector3(zx, 2.55, zz - 2.12);
    attach(banner);
    const btex = new DynamicTexture(
      "nh_retire_banner_tex",
      { width: 1024, height: 124 },
      scene,
      false,
    );
    const bctx = btex.getContext() as CanvasRenderingContext2D;
    bctx.fillStyle = "#ffd166";
    bctx.fillRect(0, 0, 1024, 124);
    const flagColors = ["#d9534f", "#3a8fd6", "#10b981", "#ffffff", "#a855f7"];
    for (let i = 0; i < 16; i++) {
      bctx.fillStyle = flagColors[i % flagColors.length];
      bctx.beginPath();
      bctx.moveTo(i * 64, 0);
      bctx.lineTo(i * 64 + 64, 0);
      bctx.lineTo(i * 64 + 32, 26);
      bctx.closePath();
      bctx.fill();
    }
    bctx.fillStyle = "#1c2230";
    const bannerText = "HAPPY RETIREMENT, GEORGE!";
    fitFont(bctx, bannerText, 960, 64, 36);
    bctx.textAlign = "center";
    bctx.textBaseline = "middle";
    bctx.fillText(bannerText, 512, 76);
    btex.update();
    const bmat = new StandardMaterial("nh_retire_banner_mat", scene);
    bmat.diffuseTexture = btex;
    bmat.emissiveColor = new Color3(0.5, 0.5, 0.5);
    bmat.specularColor = new Color3(0, 0, 0);
    banner.material = bmat;
    retirementBanner = banner;
    retirementConfettiAt = new Vector3(zx, 3.2, zz - 3.4);

    // Balloon bunches tied to the gate posts — they bob in the breeze
    // (animated once the ambient controller exists, below).
    const balloonColors = ["#d9534f", "#ffd166", "#3a8fd6", "#ffffff", "#e8a33d", "#10b981"];
    let bi = 0;
    for (const bx of [zx - 1.2, zx + 1.2]) {
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * 0.34;
        const top = 1.9 + (k % 2) * 0.35;
        makeBox(
          `nh_balloon_string_${bi}`,
          0.03,
          top - 0.5,
          0.03,
          new Vector3(bx + ox * 0.5, 0.5 + (top - 0.5) / 2, zz - 5.6),
          "#f4f0e6",
        );
        retirementBalloons.push(
          makeBox(
            `nh_balloon_${bi}`,
            0.42,
            0.5,
            0.42,
            new Vector3(bx + ox, top + 0.2, zz - 5.6),
            balloonColors[bi % balloonColors.length],
          ),
        );
        bi++;
      }
    }

    // Neighbouring house — also gets a real gable roof + chimney.
    makeBox("nh_home_h2_found", 4.6, 0.4, 4.0, new Vector3(zx + 8, 0.2, zz), "#9a8f7a");
    makeBox("nh_home_h2_base", 4.2, 2.4, 3.6, new Vector3(zx + 8, 1.6, zz), "#f0d6b0");
    makeBox(
      "nh_home_h2_trim",
      4.4,
      0.18,
      3.8,
      new Vector3(zx + 8, 2.71, zz),
      "#f4f0e6",
    );
    makeGableRoof("nh_home_h2_roof", 4.0, 3.6, zx + 8, zz, 2.8, "#7a4a3a", "#e7d8c0");
    makeChimney(zx + 9.2, zz + 0.5, 3.2, "#7a4a3a");
    makeBox("nh_home_h2_door", 0.85, 1.6, 0.16, new Vector3(zx + 8, 0.8, zz - 1.85), "#5a3a22");
    makeBox("nh_home_h2_step", 1.3, 0.16, 0.5, new Vector3(zx + 8, 0.5, zz - 2.1), "#cfc8b4");
    makeMullionedWindow("nh_home_h2_winL", zx + 6.8, 1.7, zz - 1.8, 0.9, 0.8, "south");
    makeMullionedWindow("nh_home_h2_winR", zx + 9.2, 1.7, zz - 1.8, 0.9, 0.8, "south");
    makeFrontPath("nh_home_h2_path", zx + 8, zz - 2.4, zx + 8, zz - 5.0);
    makePicketFence(zx + 5.4, zx + 7.4, zz - 5.6, 0, "#e7d8c0");
    makePicketFence(zx + 8.6, zx + 10.6, zz - 5.6, 0, "#e7d8c0");

    // Trees
    makeTree(zx - 3.5, zz + 2);
    makeTree(zx + 5.5, zz + 2.5);
    makeTree(zx + 11, zz - 2);

    // George on his front path.
    makePerson(zx - 0.2, zz - 4.6, "customerRetirement", { x: -10, z: 4 });

    // Party marker over the house (🎉)
    makeIncidentMarker(zx, 5.2, zz, "party");

    makeLabel(zx + 4, zz + 4, "Oakleigh — Retirement (George)", "#e8a33d");
  }

  // ----- Zone 2: Docklands — New Job (Priya) -----
  // East side, on the main road: Priya's new employer, a glassy fintech
  // office, with everyday cars parked along the kerb.
  {
    const zx = 22;
    const zz = 0;

    // Two cars parked well apart along the south kerb — just street life.
    // The ambient car builder models the car along local +Z, so we rotate
    // by π/2 to lay the long axis along the east-west main road.
    makeStaticVehicle(
      "nh_dock_car1",
      "car",
      new Vector3(zx - 2, 0, zz - 1.9),
      Math.PI / 2,
      "#c44a3a",
      "#a23a2c",
    );
    makeStaticVehicle(
      "nh_dock_car2",
      "car",
      new Vector3(zx + 5.5, 0, zz - 1.9),
      Math.PI / 2,
      "#3a6dc4",
      "#2a55a0",
    );

    // Docklands fintech HQ — a three-storey office with glass bands on the
    // street and east faces, an entrance canopy and a big name sign.
    const gx = zx + 4;
    const gz = zz + 8;
    makeBox("nh_hq_base", 6.0, 5.2, 4.4, new Vector3(gx, 2.6, gz), "#dfe7ee");
    makeBox("nh_hq_roof", 6.4, 0.35, 4.8, new Vector3(gx, 5.375, gz), "#2a3a5c");
    for (const gy of [2.4, 3.9]) {
      makeBox(`nh_hq_glassS_${gy}`, 5.4, 0.8, 0.08, new Vector3(gx, gy, gz - 2.24), "#7fb6e3");
      makeBox(`nh_hq_glassE_${gy}`, 0.08, 0.8, 3.8, new Vector3(gx + 3.04, gy, gz), "#7fb6e3");
    }
    makeBox("nh_hq_lobby", 2.6, 1.3, 0.08, new Vector3(gx + 1.4, 0.95, gz - 2.24), "#9fcbe8");
    makeBox("nh_hq_door", 1.4, 1.7, 0.12, new Vector3(gx - 1.4, 0.85, gz - 2.26), "#2a3a5c");
    makeBox("nh_hq_canopy", 2.2, 0.12, 1.0, new Vector3(gx - 1.4, 1.85, gz - 2.7), "#2a3a5c");
    makeTextSign(
      "nh_hq_sign",
      5.4,
      0.6,
      new Vector3(gx, 4.75, gz - 2.28),
      "DOCKLANDS FINTECH HQ",
      { bg: "#1c2230", fg: "#6ec1ff", texW: 1024, texH: 112, fontPx: 64 },
    );

    // Priya outside her new office.
    makePerson(zx + 4.6, zz + 4.6, "customerOnboarding", { x: -10, z: 4 });
    newJobConfettiAt = new Vector3(zx + 2.5, 2.4, zz + 4.6);

    // Briefcase marker (💼)
    makeIncidentMarker(zx + 1.2, 3.4, zz + 4.8, "briefcase");

    makeLabel(zx + 3, zz + 4, "Docklands — New Job (Priya)", "#3a8fd6");
  }

  // ----- Zone 3: Lygon St — Café Closed (Tom) -----
  // South-west quadrant: a row of three shopfronts. Tom's café in the
  // middle has closed — windows papered over, a CLOSED sign on the door and
  // a FOR LEASE board out front.
  {
    const zx = -18;
    const zz = -14;

    const shops: Array<[string, string]> = [
      ["#e7c8a0", "BAKERY"],
      ["#cfe1f0", "TOM'S CAFÉ"],
      ["#d8d2c0", "BOOKS"],
    ];
    for (let i = 0; i < shops.length; i++) {
      const [color, label] = shops[i];
      const sx = zx + i * 4.4;
      const closed = i === 1;
      makeBox(`nh_shop_base_${i}`, 4.0, 2.6, 3.6, new Vector3(sx, 1.3, zz), color);
      makeBox(
        `nh_shop_awning_${i}`,
        4.2,
        0.2,
        1.0,
        new Vector3(sx, 2.3, zz - 2.0),
        closed ? "#8a8f98" : "#3a5fb0",
      );
      makeBox(`nh_shop_door_${i}`, 0.9, 1.6, 0.12, new Vector3(sx, 0.8, zz - 1.85), "#5a3a22");
      makeBox(
        `nh_shop_win_${i}`,
        2.6,
        1.0,
        0.1,
        new Vector3(sx, 1.7, zz - 1.85),
        closed ? "#d8cfb8" : "#cfe7ff",
      );
      makeTextSign(`nh_shop_sign_${i}`, 3.6, 0.5, new Vector3(sx, 2.7, zz - 1.85), label, {
        bg: "#1c2230",
        fg: closed ? "#b8bec6" : "#ffd166",
        fontPx: 56,
      });
    }

    const cafeX = zx + 4.4;
    // "CLOSED" sign hanging on the café door.
    makeTextSign("nh_closed_sign", 0.9, 0.4, new Vector3(cafeX, 1.4, zz - 1.95), "CLOSED", {
      bg: "#c44a3a",
      fg: "#ffffff",
      texW: 256,
      texH: 112,
      fontPx: 64,
    });

    // "FOR LEASE" agent's board on two posts at the kerb.
    const leaseX = cafeX + 1.5;
    const leaseZ = zz - 3.0;
    for (const dx of [-0.55, 0.55]) {
      makeBox(`nh_lease_post_${dx}`, 0.08, 1.3, 0.08, new Vector3(leaseX + dx, 0.65, leaseZ + 0.05), "#5a5d65");
    }
    const lease = MeshBuilder.CreateBox(
      "nh_lease_board",
      { width: 1.5, height: 0.9, depth: 0.06 },
      scene,
    );
    lease.position = new Vector3(leaseX, 1.5, leaseZ);
    attach(lease);
    const ltex = new DynamicTexture("nh_lease_board_tex", { width: 384, height: 230 }, scene, false);
    const lctx = ltex.getContext() as CanvasRenderingContext2D;
    lctx.fillStyle = "#ffffff";
    lctx.fillRect(0, 0, 384, 230);
    lctx.fillStyle = "#e07a2c";
    lctx.fillRect(0, 0, 384, 120);
    lctx.textAlign = "center";
    lctx.textBaseline = "middle";
    lctx.fillStyle = "#ffffff";
    fitFont(lctx, "FOR LEASE", 350, 72);
    lctx.fillText("FOR LEASE", 192, 64);
    lctx.fillStyle = "#1c2230";
    fitFont(lctx, "Lygon St shopfront", 340, 36, 20);
    lctx.fillText("Lygon St shopfront", 192, 172);
    ltex.update();
    const lmat = new StandardMaterial("nh_lease_board_mat", scene);
    lmat.diffuseTexture = ltex;
    lmat.emissiveColor = new Color3(0.5, 0.5, 0.5);
    lmat.specularColor = new Color3(0, 0, 0);
    lease.material = lmat;

    // A couple of street trees along the footpath.
    makeTree(zx - 2.6, zz - 3.4, 0.75);
    makeTree(zx + 11.2, zz - 3.4, 0.75);

    // Tom outside his old café.
    makePerson(cafeX - 1.5, zz - 4.5, "customerHardship", { x: -10, z: 4 });
    cafeCloudAt = new Vector3(cafeX, 4.4, zz);
    cafeFrontAt = new Vector3(cafeX, 0, zz - 3.4);

    // Handshake marker (🤝)
    makeIncidentMarker(cafeX, 3.4, zz, "handshake");

    makeLabel(zx + 4, zz - 5.5, "Lygon St — Café Closed (Tom)", "#e07a2c");
  }

  // ----- Zone 4: Airport — Overseas Trip (Grace) -----
  // Far north-west corner — the airport Grace flew out of for her trip
  // through Italy, pushed onto the open grass beside the back-left skyline
  // tower. Sits west of Flinders Lane (kerb at x≈-28.65).
  {
    const zx = -32;
    const zz = 18;

    // Small terminal building
    makeBox("nh_term_base", 8, 3.0, 5, new Vector3(zx, 1.5, zz), "#cfe1f0");
    makeBox("nh_term_roof", 8.4, 0.4, 5.4, new Vector3(zx, 3.2, zz), "#3a5fb0");
    makeBox("nh_term_win", 6.0, 1.4, 0.1, new Vector3(zx, 1.8, zz - 2.55), "#cfe7ff");
    makeBox("nh_term_door", 1.6, 1.8, 0.15, new Vector3(zx + 2.5, 0.9, zz - 2.55), "#3a5fb0");

    // Terminal sign
    makeTextSign("nh_term_sign", 6, 0.7, new Vector3(zx, 3.55, zz - 2.6), "✈  MELBOURNE AIRPORT", {
      bg: "#1c2230",
      fg: "#ffffff",
      fontPx: 54,
    });

    // Tarmac
    makeBox("nh_tarmac", 12, 0.05, 5, new Vector3(zx - 1, 0.07, zz - 4), "#5a5d65");
    // Stripe
    makeBox("nh_tarmac_stripe", 8, 0.02, 0.2, new Vector3(zx - 1, 0.1, zz - 4), "#f4e8a8");

    // Tiny plane parked
    makeBox("nh_plane_body", 4.0, 0.7, 0.9, new Vector3(zx - 1, 0.55, zz - 4), "#ffffff");
    makeBox("nh_plane_tail", 0.6, 1.0, 0.2, new Vector3(zx + 0.8, 1.0, zz - 4), "#3a5fb0");
    makeBox("nh_plane_wing", 0.8, 0.15, 3.2, new Vector3(zx - 1, 0.7, zz - 4), "#dcdcdc");

    // Luggage trolley stacked with suitcases, ready for departure
    makeBox("nh_lug_trolley", 2.4, 0.3, 1.0, new Vector3(zx + 2, 0.25, zz - 1.5), "#7a7a7a");
    makeBox("nh_lug_case1", 0.8, 0.5, 0.6, new Vector3(zx + 2.8, 0.65, zz - 1.5), "#b03a6f");
    makeBox("nh_lug_case2", 0.8, 0.5, 0.6, new Vector3(zx + 2.0, 0.65, zz - 1.5), "#3a6dc4");
    makeBox("nh_lug_case3", 0.8, 0.5, 0.6, new Vector3(zx + 1.2, 0.65, zz - 1.5), "#5a8a4a");

    // Grace with her phone, about to fly out
    makePerson(zx + 1, zz - 0.5, "customerProtection", { x: -10, z: 4 });
    graceAlertAt = new Vector3(zx + 1, 0, zz - 0.5);

    // Shield marker (🛡️) — her account is being protected
    makeIncidentMarker(zx + 2, 2.4, zz - 1.5, "shield");

    // Pushed south-east of the terminal so the label sits on open grass
    // between the airport and the main road, instead of running off the
    // western edge of the map.
    makeLabel(zx + 2, zz - 12, "Airport — Overseas Trip (Grace)", "#d9534f");
  }

  // ----- Zone 5: Box Hill — Family Home (Robert) -----
  // South-east quadrant — handled with a calm, respectful tone.
  {
    const zx = 16;
    const zz = -16;
    familyHomeCenter = new Vector3(zx, 0.1, zz);

    // The family home, set apart — full suburban detail with a slate gable
    // roof, a chimney, mullioned windows, and a soft front path.
    makeBox("nh_life_found", 5.0, 0.4, 4.4, new Vector3(zx, 0.2, zz), "#9a8f7a");
    makeBox("nh_life_base", 4.6, 2.6, 4, new Vector3(zx, 1.7, zz), "#f0e6d2");
    makeBox(
      "nh_life_trim",
      4.8,
      0.18,
      4.2,
      new Vector3(zx, 2.91, zz),
      "#fff8e6",
    );
    makeGableRoof("nh_life_roof", 4.6, 4, zx, zz, 3.0, "#5a6a7c", "#dcd0bc");
    makeChimney(zx - 1.4, zz + 0.5, 3.4, "#7a6a5c");
    makeBox("nh_life_door", 0.95, 1.7, 0.16, new Vector3(zx, 0.85, zz - 2.05), "#3a3a3a");
    makeBox("nh_life_step", 1.4, 0.16, 0.5, new Vector3(zx, 0.5, zz - 2.3), "#cfc8b4");
    makeMullionedWindow("nh_life_winL", zx - 1.55, 1.7, zz - 2.0, 1.0, 0.85, "south");
    makeMullionedWindow("nh_life_winR", zx + 1.55, 1.7, zz - 2.0, 1.0, 0.85, "south");
    makeMullionedWindow("nh_life_winE", zx + 2.3, 1.7, zz, 0.9, 0.85, "east");

    // Driveway with parked family car — a proper voxel sedan.
    makeBox("nh_life_drive", 2.6, 0.05, 4, new Vector3(zx - 3.5, 0.07, zz - 1), "#b8b0a0");
    makeStaticVehicle(
      "nh_life_car",
      "car",
      new Vector3(zx - 3.5, 0, zz - 1),
      0,
      "#5a6a7c",
      "#3a4a5c",
    );

    // Garden — flowerbed (no alarm symbols)
    makeBox("nh_life_bed", 3.0, 0.1, 0.6, new Vector3(zx, 0.12, zz + 2.4), "#7a4f2a");
    for (let i = -1; i <= 1; i++) {
      makeBox(
        `nh_life_flower_${i}`,
        0.3,
        0.4,
        0.3,
        new Vector3(zx + i * 1.0, 0.35, zz + 2.4),
        i === 0 ? "#f4a3c7" : "#ffd166",
      );
    }

    // Trees nearby
    makeTree(zx + 4, zz - 3);
    makeTree(zx - 6, zz + 3, 0.9);

    // A small remembrance wreath at the door — gentle, no alarm symbols.
    makeBox("nh_life_wreath_outer", 0.7, 0.7, 0.08, new Vector3(zx, 1.6, zz - 2.1), "#5fa657");
    makeBox("nh_life_wreath_inner", 0.4, 0.4, 0.06, new Vector3(zx, 1.6, zz - 2.08), "#fff8e6");
    makeBox("nh_life_wreath_ribbon", 0.18, 0.55, 0.06, new Vector3(zx, 1.25, zz - 2.08), "#c2566f");

    // Robert walking calmly down the path
    makePerson(zx - 2.5, zz - 4, "customerBereavement", { x: -10, z: 4 });

    // Soft heart marker (gentle)
    makeIncidentMarker(zx, 4.6, zz, "heart");

    makeLabel(zx, zz + 5, "Box Hill — Family Home (Robert)", "#6e7a8a");
  }

  // ----- Apartment block (south-west corner) -----
  // A three-storey walk-up on the far left edge of the map — everyday
  // residential scenery that keeps the corner from reading as empty while
  // leaving the foreground clear toward the central roundabout.
  {
    const zx = -32;
    const zz = -28;

    // Three-storey apartment block
    makeBox("nh_apt_base", 7.0, 7.5, 5.0, new Vector3(zx, 3.75, zz), "#cfbfa8");
    makeBox("nh_apt_roof", 7.4, 0.4, 5.4, new Vector3(zx, 7.7, zz), "#5a4a3a");
    // Entry stoop
    makeBox("nh_apt_stoop", 2.6, 0.2, 1.4, new Vector3(zx, 0.2, zz - 2.85), "#b8b0a0");

    // Windows in a 3x3 grid on the front face
    const aptWin = mat("aptWin", "#cfe7ff");
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col++) {
        const w = MeshBuilder.CreateBox(
          `nh_apt_win_${row}_${col}`,
          { width: 1.0, height: 0.8, depth: 0.1 },
          scene,
        );
        w.position = new Vector3(zx + col * 2.2, 1.6 + row * 2.2, zz - 2.55);
        w.material = aptWin;
        attach(w);
      }
    }

    // Front door
    makeBox("nh_apt_door", 1.0, 1.8, 0.16, new Vector3(zx, 0.95, zz - 2.55), "#5a3a22");

    // A resident's car parked out front — proper voxel sedan.
    makeStaticVehicle(
      "nh_apt_car",
      "car",
      new Vector3(zx + 5, 0, zz - 3.5),
      0,
      "#2a3a5c",
      "#1c2230",
    );

    // Trees / planter beside the building
    makeTree(zx - 5, zz - 1, 0.9);
    makeTree(zx + 5.5, zz + 2, 0.9);
  }

