import {
  Animation,
  ArcRotateCamera,
  CubicEase,
  EasingFunction,
  Vector3,
} from "@babylonjs/core";

/**
 * Smoothly retargets an `ArcRotateCamera` for page turns and selections.
 *
 * Every camera move animates `target`, `radius`, `alpha`, `beta` together
 * with a cubic ease so moves feel cinematic without fighting
 * the user's manual orbit input (we only animate on explicit calls).
 */
export interface CameraFraming {
  /** World-space point to focus on. */
  target: Vector3;
  /** Distance from target. */
  radius?: number;
  /** Horizontal angle (radians). */
  alpha?: number;
  /** Vertical angle (radians). */
  beta?: number;
  /** Animation duration (seconds). Defaults to 1.2s. */
  durationSec?: number;
}

const FPS = 60;

export class CameraDirector {
  constructor(private readonly camera: ArcRotateCamera) {}

  /** Animate the camera to a new framing. */
  focus(framing: CameraFraming): void {
    const duration = framing.durationSec ?? 1.2;
    const frames = Math.max(2, Math.round(duration * FPS));

    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

    const animate = <T>(
      property: string,
      from: T,
      to: T,
      type: number,
    ): void => {
      const anim = new Animation(
        `cam_${property}_${Date.now()}`,
        property,
        FPS,
        type,
        Animation.ANIMATIONLOOPMODE_CONSTANT,
      );
      anim.setKeys([
        { frame: 0, value: from },
        { frame: frames, value: to },
      ]);
      anim.setEasingFunction(ease);
      this.camera.animations.push(anim);
    };

    // Reset previous animations so a new move overrides cleanly.
    this.camera.animations = [];

    if (framing.target) {
      animate(
        "target",
        this.camera.target.clone(),
        framing.target.clone(),
        Animation.ANIMATIONTYPE_VECTOR3,
      );
    }
    if (framing.radius !== undefined) {
      animate(
        "radius",
        this.camera.radius,
        framing.radius,
        Animation.ANIMATIONTYPE_FLOAT,
      );
    }
    if (framing.alpha !== undefined) {
      animate(
        "alpha",
        this.camera.alpha,
        framing.alpha,
        Animation.ANIMATIONTYPE_FLOAT,
      );
    }
    if (framing.beta !== undefined) {
      animate(
        "beta",
        this.camera.beta,
        framing.beta,
        Animation.ANIMATIONTYPE_FLOAT,
      );
    }

    this.camera.getScene().beginAnimation(this.camera, 0, frames, false);
  }
}
