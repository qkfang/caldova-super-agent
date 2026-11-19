/* ------------------------------------------------------------------------ */
/* Life-event animation factories                                           */
/* ------------------------------------------------------------------------ */

/** A reusable burst of voxel confetti that pops up and flutters down. */
interface ConfettiBurst {
  launch(origin: Vector3): void;
  update(dtSec: number): void;
  reset(): void;
}

function createConfettiBurst(
  scene: Scene,
  root: TransformNode,
  name: string,
  colors: string[],
  count = 28,
): ConfettiBurst {
  const mats = colors.map((hex, i) => {
    const m = new StandardMaterial(`${name}_mat_${i}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = Color3.FromHexString(hex).scale(0.35);
    m.specularColor = new Color3(0, 0, 0);
    return m;
  });
  const pieces: Array<{ mesh: Mesh; vel: Vector3; spin: Vector3; life: number }> = [];
  for (let i = 0; i < count; i++) {
    const mesh = MeshBuilder.CreateBox(
      `${name}_${i}`,
      { width: 0.18, height: 0.04, depth: 0.12 },
      scene,
    );
    mesh.parent = root;
    mesh.material = mats[i % mats.length];
    mesh.isPickable = false;
    mesh.isVisible = false;
    pieces.push({ mesh, vel: Vector3.Zero(), spin: Vector3.Zero(), life: 0 });
  }
  return {
    launch: (origin) => {
      for (const p of pieces) {
        const angle = Math.random() * Math.PI * 2;
        const out = 0.8 + Math.random() * 2.0;
        p.vel = new Vector3(
          Math.cos(angle) * out,
          4.0 + Math.random() * 2.5,
          Math.sin(angle) * out,
        );
        p.spin = new Vector3(
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
          Math.random() * 10 - 5,
        );
        p.life = 2.4 + Math.random() * 1.4;
        p.mesh.position = origin.clone();
        p.mesh.isVisible = true;
      }
    },
    update: (dt) => {
      const drag = Math.exp(-1.4 * dt);
      for (const p of pieces) {
        if (!p.mesh.isVisible) continue;
        // Light gravity with a capped fall speed so the pieces flutter down.
        p.vel.y = Math.max(-1.4, p.vel.y - 7.0 * dt);
        p.vel.x *= drag;
        p.vel.z *= drag;
        p.mesh.position.addInPlace(p.vel.scale(dt));
        p.mesh.rotation.addInPlace(p.spin.scale(dt));
        p.life -= dt;
        if (p.life <= 0 || p.mesh.position.y <= 0.08) p.mesh.isVisible = false;
      }
    },
    reset: () => {
      for (const p of pieces) p.mesh.isVisible = false;
    },
  };
}

/**
 * New job (onboarding): two pops of confetti in Caldova's department
 * colours over the Docklands forecourt — a fresh start worth celebrating.
 */
export function makeCelebrationIncident(
  scene: Scene,
  root: TransformNode,
  origin: Vector3,
): IncidentAnimation {
  const colors = ["#0ea5e9", "#ffd166", "#ec4899", "#10b981", "#ffffff"];
  const first = createConfettiBurst(scene, root, "nh_newjob_confetti_a", colors);
  const second = createConfettiBurst(scene, root, "nh_newjob_confetti_b", colors);
  let elapsed = 0;
  let running = false;
  let secondFired = false;
  const duration = 4.5;

  const reset = (): void => {
    first.reset();
    second.reset();
  };

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      secondFired = false;
      reset();
      first.launch(origin);
    },
    stop: () => {
      running = false;
      reset();
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      if (!secondFired && elapsed >= 1.2) {
        secondFired = true;
        second.launch(origin.add(new Vector3(1.2, 0.6, 0.4)));
      }
      first.update(dt);
      second.update(dt);
      if (elapsed >= duration) {
        running = false;
        reset();
      }
    },
  };
}

/**
 * Identity-takeover attempt (protection): red rings pulse outward around
 * the member like a radar ping while a phone alert badge bounces overhead —
 * someone is trying to move her super while she is overseas.
 */
export function makeIdentityAlertIncident(
  scene: Scene,
  root: TransformNode,
  center: Vector3,
): IncidentAnimation {
  const rings: Array<{ mesh: Mesh; mat: StandardMaterial }> = [];
  for (let i = 0; i < 2; i++) {
    const mesh = MeshBuilder.CreateTorus(
      `nh_alert_ring_${i}`,
      { diameter: 2.4, thickness: 0.14, tessellation: 40 },
      scene,
    );
    mesh.parent = root;
    mesh.position = new Vector3(center.x, 0.14, center.z);
    const mat = new StandardMaterial(`nh_alert_ring_mat_${i}`, scene);
    mat.diffuseColor = Color3.FromHexString("#ef4444");
    mat.emissiveColor = Color3.FromHexString("#ef4444");
    mat.specularColor = new Color3(0, 0, 0);
    mat.alpha = 0;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.isVisible = false;
    rings.push({ mesh, mat });
  }

  // Bouncing alert badge: a red disc with a phone glyph, always facing
  // the camera.
  const badge = MeshBuilder.CreatePlane(
    "nh_alert_badge",
    { width: 1.1, height: 1.1 },
    scene,
  );
  badge.parent = root;
  badge.billboardMode = Mesh.BILLBOARDMODE_ALL;
  badge.isPickable = false;
  badge.isVisible = false;
  const tex = new DynamicTexture("nh_alert_badge_tex", { width: 256, height: 256 }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.font = "120px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📱", 128, 136);
  tex.update();
  const badgeMat = new StandardMaterial("nh_alert_badge_mat", scene);
  badgeMat.diffuseTexture = tex;
  badgeMat.opacityTexture = tex;
  badgeMat.emissiveColor = new Color3(1, 1, 1);
  badgeMat.disableLighting = true;
  badgeMat.backFaceCulling = false;
  badge.material = badgeMat;
  const badgeBaseY = center.y + 3.2;

  let elapsed = 0;
  let running = false;
  const duration = 4.5;

  const hide = (): void => {
    for (const r of rings) {
      r.mesh.isVisible = false;
      r.mat.alpha = 0;
    }
    badge.isVisible = false;
  };
  hide();

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      for (const r of rings) r.mesh.isVisible = true;
      badge.isVisible = true;
      badge.position = new Vector3(center.x, badgeBaseY, center.z);
    },
    stop: () => {
      running = false;
      hide();
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      // Each ring expands and fades over 1.4 s, offset by half a cycle.
      for (let i = 0; i < rings.length; i++) {
        const phase = (elapsed / 1.4 + i * 0.5) % 1;
        const s = 0.5 + phase * 1.7;
        rings[i].mesh.scaling = new Vector3(s, 1, s);
        rings[i].mat.alpha = (1 - phase) * 0.85;
      }
      badge.position.y = badgeBaseY + Math.abs(Math.sin(elapsed * 4.2)) * 0.55;
      if (elapsed >= duration) {
        running = false;
        hide();
      }
    },
  };
}

/**
 * Retirement: the "Happy Retirement" banner unfurls with a little bounce
 * and confetti pops over the front garden.
 */
export function makeRetirementIncident(
  scene: Scene,
  root: TransformNode,
  banner: Mesh,
  confettiOrigin: Vector3,
): IncidentAnimation {
  const baseScale = banner.scaling.clone();
  const baseRotZ = banner.rotation.z;
  const colors = ["#e8a33d", "#ffd166", "#3a8fd6", "#d9534f", "#ffffff"];
  const first = createConfettiBurst(scene, root, "nh_retire_confetti_a", colors);
  const second = createConfettiBurst(scene, root, "nh_retire_confetti_b", colors);
  let elapsed = 0;
  let running = false;
  let secondFired = false;
  const duration = 4.5;

  const restore = (): void => {
    banner.scaling = baseScale.clone();
    banner.rotation.z = baseRotZ;
    first.reset();
    second.reset();
  };

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      secondFired = false;
      restore();
      banner.scaling = new Vector3(baseScale.x, baseScale.y * 0.05, baseScale.z);
      first.launch(confettiOrigin);
    },
    stop: () => {
      running = false;
      restore();
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      // Unfurl over 0.6 s with a small overshoot, then sway gently.
      const t = Math.min(1, elapsed / 0.6);
      const overshoot = Math.sin(t * Math.PI) * 0.2;
      banner.scaling.y = baseScale.y * Math.max(0.05, t + overshoot);
      banner.rotation.z = baseRotZ + Math.sin(elapsed * 3) * 0.03;
      if (!secondFired && elapsed >= 1.5) {
        secondFired = true;
        second.launch(confettiOrigin.add(new Vector3(-1.4, 0.3, 0)));
      }
      first.update(dt);
      second.update(dt);
      if (elapsed >= duration) {
        running = false;
        restore();
      }
    },
  };
}

/**
 * Financial hardship (café closed): a soft grey cloud gathers over the
 * shuttered café while the shopfront pavement dims — a quiet, respectful
 * cue rather than an alarm.
 */
export function makeHardshipCloudIncident(
  scene: Scene,
  root: TransformNode,
  cloudCenter: Vector3,
  groundCenter: Vector3,
): IncidentAnimation {
  const cloudMat = new StandardMaterial("nh_hardship_cloud_mat", scene);
  cloudMat.diffuseColor = Color3.FromHexString("#9aa0a8");
  cloudMat.emissiveColor = Color3.FromHexString("#5a6068");
  cloudMat.specularColor = new Color3(0, 0, 0);
  cloudMat.alpha = 0;
  const puffs: Array<{ mesh: Mesh; base: Vector3 }> = [];
  const puffDefs: Array<[number, number, number, number]> = [
    // [dx, dy, dz, size]
    [-0.9, 0, 0, 1.4],
    [0.4, 0.3, 0.2, 1.7],
    [1.5, -0.05, -0.1, 1.2],
    [-0.1, 0.55, -0.3, 1.1],
  ];
  for (let i = 0; i < puffDefs.length; i++) {
    const [dx, dy, dz, size] = puffDefs[i];
    const mesh = MeshBuilder.CreateBox(
      `nh_hardship_cloud_${i}`,
      { width: size, height: size * 0.6, depth: size * 0.8 },
      scene,
    );
    mesh.parent = root;
    mesh.material = cloudMat;
    mesh.isPickable = false;
    mesh.isVisible = false;
    const base = new Vector3(cloudCenter.x + dx, cloudCenter.y + dy, cloudCenter.z + dz);
    mesh.position = base.clone();
    puffs.push({ mesh, base });
  }

  const dim = MeshBuilder.CreateCylinder(
    "nh_hardship_dim",
    { diameter: 5.5, height: 0.03 },
    scene,
  );
  dim.parent = root;
  dim.position = new Vector3(groundCenter.x, 0.1, groundCenter.z);
  const dimMat = new StandardMaterial("nh_hardship_dim_mat", scene);
  dimMat.diffuseColor = Color3.FromHexString("#3a3f48");
  dimMat.specularColor = new Color3(0, 0, 0);
  dimMat.alpha = 0;
  dim.material = dimMat;
  dim.isPickable = false;
  dim.isVisible = false;

  let elapsed = 0;
  let running = false;
  const duration = 4.5;

  const hide = (): void => {
    cloudMat.alpha = 0;
    dimMat.alpha = 0;
    for (const p of puffs) {
      p.mesh.isVisible = false;
      p.mesh.position = p.base.clone();
    }
    dim.isVisible = false;
  };
  hide();

  return {
    durationSec: duration,
    start: () => {
      elapsed = 0;
      running = true;
      for (const p of puffs) p.mesh.isVisible = true;
      dim.isVisible = true;
    },
    stop: () => {
      running = false;
      hide();
    },
    update: (dt) => {
      if (!running) return;
      elapsed += dt;
      const t = Math.min(1, elapsed / duration);
      // Fade in, hold, fade out — never a hard flash.
      const fade = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
      cloudMat.alpha = 0.78 * fade;
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        p.mesh.position.x = p.base.x + t * 0.8;
        p.mesh.position.y = p.base.y + Math.sin(elapsed * 1.6 + i) * 0.08;
      }
      dimMat.alpha = (0.16 + 0.08 * Math.sin(elapsed * 2.2)) * fade;
      if (elapsed >= duration) {
        running = false;
        hide();
      }
    },
  };
}

