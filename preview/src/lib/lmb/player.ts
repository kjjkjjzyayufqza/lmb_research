import type { SpriteDef, FrameDef } from "./types";
import { ResourceStore } from "./store";
import { Scene } from "./scene";
import { ActionInterpreter } from "./actions";

export type FrameChangeCallback = (
  frame: FrameDef | undefined,
  scene: Scene,
  frameIndex: number
) => void;

/**
 * TimelinePlayer drives frame-by-frame playback of a sprite timeline.
 * Supports play / pause / stop / loop / scrub (deterministic rebuild).
 */
export class TimelinePlayer {
  private resourceStore: ResourceStore;
  private sprite: SpriteDef;
  private scene: Scene;
  private frameIndex = 0;
  private playing = false;
  private lastTime = 0;
  private frameDurationMs: number;
  private onFrameChanged?: FrameChangeCallback;
  private onLog?: (msg: string) => void;
  private loop: boolean;

  constructor(
    resourceStore: ResourceStore,
    sprite: SpriteDef,
    scene: Scene,
    onFrameChanged?: FrameChangeCallback,
    onLog?: (msg: string) => void,
    loop: boolean = false
  ) {
    this.resourceStore = resourceStore;
    this.sprite = sprite;
    this.scene = scene;
    this.frameDurationMs =
      1000 / Math.max(1, resourceStore.getMeta().framerate || 30);
    this.onFrameChanged = onFrameChanged;
    this.onLog = onLog;
    this.loop = loop;
  }

  play(): void {
    if (this.playing) return;
    const totalFrames = this.sprite.timeline.length;
    if (!this.loop && totalFrames > 0 && this.frameIndex >= totalFrames - 1) {
      this.frameIndex = 0;
      this.scene.reset();
      this.applyCurrentFrame();
    }
    this.playing = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  pause(): void {
    this.playing = false;
  }

  stop(): void {
    this.playing = false;
    this.frameIndex = 0;
    this.scene.reset();
    this.applyCurrentFrame();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getLoop(): boolean {
    return this.loop;
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
  }

  getCurrentFrameIndex(): number {
    return this.frameIndex;
  }

  getCurrentFrame(): FrameDef | undefined {
    return this.sprite.timeline[this.frameIndex];
  }

  getSprite(): SpriteDef {
    return this.sprite;
  }

  getScene(): Scene {
    return this.scene;
  }

  getTotalFrames(): number {
    return this.sprite.timeline.length;
  }

  /**
   * Jump directly to a target frame index.
   * Uses non-deterministic jump (just sets index and applies that single frame).
   */
  goToFrame(targetIndex: number): void {
    const totalFrames = this.sprite.timeline.length;
    if (totalFrames === 0) return;
    this.frameIndex =
      ((Math.floor(targetIndex) % totalFrames) + totalFrames) % totalFrames;
    this.applyCurrentFrame();
  }

  /**
   * Deterministic rebuild: reset scene and replay frames 0..targetIndex
   * to guarantee the display list state is identical to what it would be
   * during sequential playback.
   */
  scrubToFrame(targetIndex: number): void {
    const totalFrames = this.sprite.timeline.length;
    if (totalFrames === 0) return;
    const normalized =
      ((Math.floor(targetIndex) % totalFrames) + totalFrames) % totalFrames;

    this.scene.reset();
    for (let i = 0; i <= normalized; i++) {
      this.scene.applyFrame(this.resourceStore, this.sprite.timeline[i]);
    }
    this.frameIndex = normalized;

    const frame = this.getCurrentFrame();
    this.onFrameChanged?.(frame, this.scene, this.frameIndex);
  }

  /**
   * Step forward by one frame.
   */
  stepForward(): void {
    const totalFrames = this.sprite.timeline.length;
    if (totalFrames === 0) return;
    if (this.frameIndex < totalFrames - 1) {
      this.frameIndex += 1;
    } else if (this.loop) {
      this.frameIndex = 0;
      this.scene.reset();
    }
    this.applyCurrentFrame();
  }

  /**
   * Step backward by one frame (deterministic rebuild).
   */
  stepBackward(): void {
    const totalFrames = this.sprite.timeline.length;
    if (totalFrames === 0) return;
    if (this.frameIndex > 0) {
      this.scrubToFrame(this.frameIndex - 1);
    } else if (this.loop) {
      this.scrubToFrame(totalFrames - 1);
    }
  }

  private tick = (now: number): void => {
    if (!this.playing) return;

    const delta = now - this.lastTime;
    if (delta >= this.frameDurationMs) {
      const framesToAdvance = Math.floor(delta / this.frameDurationMs);
      this.lastTime = now;

      const totalFrames = this.sprite.timeline.length;
      if (totalFrames > 0) {
        let remaining = framesToAdvance;
        let advanced = 0;

        while (remaining > 0 && this.playing) {
          if (this.frameIndex >= totalFrames - 1) {
            if (this.loop) {
              this.frameIndex = 0;
              this.scene.reset();
            } else {
              this.playing = false;
              break;
            }
          } else {
            this.frameIndex += 1;
          }
          this.applyCurrentFrame();
          remaining -= 1;
          advanced += 1;
        }

        if (advanced > 0) {
          this.scene.advanceNestedSprites(this.resourceStore, advanced);
        }
      }
    }

    if (this.playing) {
      requestAnimationFrame(this.tick);
    }
  };

  private applyCurrentFrame(recursionDepth = 0): void {
    if (recursionDepth > 5) {
      this.onLog?.(
        "Max recursion depth reached in applyCurrentFrame. Stopping."
      );
      this.playing = false;
      return;
    }

    const frame = this.getCurrentFrame();
    if (!frame) return;
    this.scene.applyFrame(this.resourceStore, frame);

    // Execute frame actions
    if (frame.actions.length > 0) {
      for (const action of frame.actions) {
        const result = ActionInterpreter.execute(action, this.sprite);
        if (result.log) this.onLog?.(result.log);

        if (result.playing !== undefined) {
          this.playing = result.playing;
        }

        if (result.jumpToFrame !== undefined) {
          const totalFrames = this.sprite.timeline.length;
          if (totalFrames > 0) {
            this.frameIndex =
              ((Math.floor(result.jumpToFrame) % totalFrames) + totalFrames) %
              totalFrames;
            this.applyCurrentFrame(recursionDepth + 1);
            return;
          }
        }
      }
    }

    this.onFrameChanged?.(frame, this.scene, this.frameIndex);
  }
}
