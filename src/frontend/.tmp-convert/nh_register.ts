  // Retirement balloons on George's gate posts bob and sway gently in the
  // breeze — always on, independent of any scenario.
  if (retirementBalloons.length > 0) {
    const balloonBase = retirementBalloons.map((b) => b.position.clone());
    let breeze = 0;
    ambient.addAnimation((dt) => {
      breeze += dt;
      for (let i = 0; i < retirementBalloons.length; i++) {
        const b = retirementBalloons[i];
        b.position.y = balloonBase[i].y + Math.sin(breeze * 1.8 + i * 1.3) * 0.06;
        b.position.x = balloonBase[i].x + Math.sin(breeze * 1.1 + i) * 0.04;
        b.rotation.z = Math.sin(breeze * 1.4 + i * 0.7) * 0.08;
      }
    });
  }

  // Register the per-scenario life-event animations.
  if (newJobConfettiAt) {
    ambient.registerIncident(
      "onboarding",
      makeCelebrationIncident(scene, root, newJobConfettiAt),
    );
  }
  if (graceAlertAt) {
    ambient.registerIncident(
      "protection",
      makeIdentityAlertIncident(scene, root, graceAlertAt),
    );
  }
  if (retirementBanner && retirementConfettiAt) {
    ambient.registerIncident(
      "retirement",
      makeRetirementIncident(scene, root, retirementBanner, retirementConfettiAt),
    );
  }
  if (cafeCloudAt && cafeFrontAt) {
    ambient.registerIncident(
      "hardship",
      makeHardshipCloudIncident(scene, root, cafeCloudAt, cafeFrontAt),
    );
  }
  if (familyHomeCenter) {
    ambient.registerIncident(
      "bereavement",
      makeCalmGlowIncident(scene, root, familyHomeCenter),
    );
  }

