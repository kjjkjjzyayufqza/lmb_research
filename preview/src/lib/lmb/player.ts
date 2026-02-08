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
 * Compute the number of playable (non-keyframe) frames for a sprite.
 *
 * LMB sprites store `numFrames` regular frames followed by `numKeyframes`
 * snapshot frames in the same `timeline` array.  Only the first
 * `numFrames` entries are meant for sequential playback; the trailing
 * keyframes are complete display-list snapshots used for fast random
 * access (scrubbing / gotoAndPlay).
 */
function getPlayableFrameCount(sprite: SpriteDef): number {
  // numFrames is authoritative; fall back to timeline length when missing
  // (e.g. if the JSON was hand-crafted without the field).
  if (sprite.numFrames > 0 && sprite.numFrames <= sprite.timeline.length) {
    return sprite.numFrames;
  }
  return sprite.timeline.length;
}

/**
 * Find the keyframe entry whose frame index is closest to (but not
 * exceeding) the target playable frame.  Returns the keyframe's
 * position inside the `timeline` array, or -1 if no suitable keyframe
 * exists.
 *
 * Keyframes occupy indices `[numFrames .. timeline.length)` and each
 * carries a complete display-list snapshot.  They correspond 1-to-1
 * with the sprite's frame labels (sorted by label frame index).
 */
function findNearestKeyframeIndex(
  sprite: SpriteDef,
  targetPlayableFrame: number
): number {
  const numPlayable = getPlayableFrameCount(sprite);
  const labels = Object.entries(sprite.frameLabels).sort(
    (a, b) => a[1] - b[1]
  );

  // Keyframes start at timeline[numPlayable] and there should be one per label.
  let bestTimelineIdx = -1;
  for (let ki = 0; ki < labels.length; ki++) {
    const labelFrame = labels[ki][1];
    const timelineIdx = numPlayable + ki;
    if (
      timelineIdx < sprite.timeline.length &&
      sprite.timeline[timelineIdx].isKeyframe &&
      labelFrame <= targetPlayableFrame
    ) {
      bestTimelineIdx = timelineIdx;
    }
  }
  return bestTimelineIdx;
}

export interface LabelSection {
  label: string;
  startFrame: number;
  endFrame: number;
}

/**
 * Build a list of labeled sections from a sprite definition.
 * Each section spans from its label frame to the frame just before the
 * next label (or to the last playable frame for the final section).
 */
export function getLabelSections(sprite: SpriteDef): LabelSection[] {
  const numPlayable = getPlayableFrameCount(sprite);
  if (numPlayable === 0) return [];

  const entries = Object.entries(sprite.frameLabels).sort(
    (a, b) => a[1] - b[1]
  );
  if (entries.length === 0) return [];

  const sections: LabelSection[] = [];
  for (let i = 0; i < entries.length; i++) {
    const [label, startFrame] = entries[i];
    const endFrame =
      i < entries.length - 1
        ? entries[i + 1][1] - 1
        : numPlayable - 1;
    sections.push({ label, startFrame, endFrame });
  }
  return sections;
}

/**
 * TimelinePlayer drives frame-by-frame playback of a sprite timeline.
 * Supports play / pause / stop / loop / scrub (deterministic rebuild)
 * and section-based playback for label-segmented UI animations.
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

  /**
   * The number of playable frames (excludes trailing keyframes).
   * All frame indices during playback are clamped to [0, playableCount).
   */
  private playableCount: number;

  /**
   * When set, playback is restricted to [sectionStart, sectionEnd]
   * and loops (or stops) within that range.
   */
  private sectionStart = -1;
  private sectionEnd = -1;

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
    this.playableCount = getPlayableFrameCount(sprite);
    this.frameDurationMs =
      1000 / Math.max(1, resourceStore.getMeta().framerate || 30);
    this.onFrameChanged = onFrameChanged;
    this.onLog = onLog;
    this.loop = loop;
  }

  // ---- Basic controls ----

  play(): void {
    if (this.playing) return;
    const end = this.effectiveEnd();
    if (end <= 0) return;

    // If at the end, wrap around before starting
    if (!this.loop && this.frameIndex >= end) {
      this.frameIndex = this.effectiveStart();
      this.rebuildToFrame(this.frameIndex);
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
    this.frameIndex = this.effectiveStart();
    this.rebuildToFrame(this.frameIndex);
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

  /**
   * Returns the number of playable frames (excludes keyframes).
   */
  getTotalFrames(): number {
    return this.playableCount;
  }

  // ---- Section-based playback ----

  /**
   * Play a specific labeled section.  The player jumps to the section's
   * start frame (using keyframe-accelerated scrub) and plays until the
   * section's end frame (where a stop() action will normally halt it).
   */
  playSection(label: string): void {
    const sections = getLabelSections(this.sprite);
    const section = sections.find((s) => s.label === label);
    if (!section) {
      this.onLog?.(`Section "${label}" not found`);
      return;
    }

    this.sectionStart = section.startFrame;
    this.sectionEnd = section.endFrame;

    // Scrub to start of section
    this.rebuildToFrame(section.startFrame);
    this.frameIndex = section.startFrame;

    // Start playing
    this.playing = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  /**
   * Clear any active section restriction so playback covers the full
   * range of playable frames.
   */
  clearSection(): void {
    this.sectionStart = -1;
    this.sectionEnd = -1;
  }

  getSectionStart(): number {
    return this.sectionStart;
  }

  getSectionEnd(): number {
    return this.sectionEnd;
  }

  // ---- Scrub / step ----

  /**
   * Jump directly to a target frame index (non-deterministic).
   */
  goToFrame(targetIndex: number): void {
    if (this.playableCount === 0) return;
    this.frameIndex = this.clampFrame(targetIndex);
    this.applyCurrentFrame();
  }

  /**
   * Deterministic rebuild: reset scene and replay frames 0..targetIndex.
   * Uses the nearest keyframe as a starting point for efficiency.
   */
  scrubToFrame(targetIndex: number): void {
    if (this.playableCount === 0) return;
    const clamped = this.clampFrame(targetIndex);
    this.rebuildToFrame(clamped);
  }

  /**
   * Step forward by one frame.
   */
  stepForward(): void {
    if (this.playableCount === 0) return;
    const end = this.effectiveEnd();
    if (this.frameIndex < end) {
      this.frameIndex += 1;
    } else if (this.loop) {
      this.frameIndex = this.effectiveStart();
      this.scene.reset();
    }
    this.applyCurrentFrame();
  }

  /**
   * Step backward by one frame (deterministic rebuild).
   */
  stepBackward(): void {
    if (this.playableCount === 0) return;
    const start = this.effectiveStart();
    if (this.frameIndex > start) {
      this.rebuildToFrame(this.frameIndex - 1);
    } else if (this.loop) {
      this.rebuildToFrame(this.effectiveEnd());
    }
  }

  // ---- Internal helpers ----

  private effectiveStart(): number {
    return this.sectionStart >= 0 ? this.sectionStart : 0;
  }

  private effectiveEnd(): number {
    if (this.sectionEnd >= 0 && this.sectionEnd < this.playableCount) {
      return this.sectionEnd;
    }
    return this.playableCount - 1;
  }

  private clampFrame(index: number): number {
    const n = Math.floor(index);
    if (n < 0) return 0;
    if (n >= this.playableCount) return this.playableCount - 1;
    return n;
  }

  /**
   * Deterministic rebuild to a specific playable frame.
   * Tries to start from the nearest keyframe for performance,
   * falling back to replaying from frame 0.
   */
  private rebuildToFrame(target: number): void {
    const clamped = this.clampFrame(target);

    // Try keyframe-accelerated rebuild
    const kfIdx = findNearestKeyframeIndex(this.sprite, clamped);

    if (kfIdx >= 0) {
      // Apply the keyframe snapshot (it contains a full display list)
      const kfFrame = this.sprite.timeline[kfIdx];
      this.scene.reset();
      this.scene.applyFrame(this.resourceStore, kfFrame);

      // Determine which playable frame the keyframe corresponds to.
      // Keyframes are in order matching sorted labels.
      const labels = Object.entries(this.sprite.frameLabels).sort(
        (a, b) => a[1] - b[1]
      );
      const kfPlayableFrame = labels[kfIdx - this.playableCount]?.[1] ?? 0;

      // Replay remaining frames from keyframe's label frame to the target
      for (let i = kfPlayableFrame + 1; i <= clamped; i++) {
        this.scene.applyFrame(this.resourceStore, this.sprite.timeline[i]);
      }
    } else {
      // No suitable keyframe: full replay from frame 0
      this.scene.reset();
      for (let i = 0; i <= clamped; i++) {
        this.scene.applyFrame(this.resourceStore, this.sprite.timeline[i]);
      }
    }

    this.frameIndex = clamped;
    const frame = this.getCurrentFrame();
    this.onFrameChanged?.(frame, this.scene, this.frameIndex);
  }

  // ---- Playback tick ----

  private tick = (now: number): void => {
    if (!this.playing) return;

    const delta = now - this.lastTime;
    if (delta >= this.frameDurationMs) {
      const framesToAdvance = Math.floor(delta / this.frameDurationMs);
      this.lastTime = now;

      if (this.playableCount > 0) {
        let remaining = framesToAdvance;
        let advanced = 0;
        const end = this.effectiveEnd();
        const start = this.effectiveStart();

        while (remaining > 0 && this.playing) {
          if (this.frameIndex >= end) {
            if (this.loop) {
              this.frameIndex = start;
              this.scene.reset();
              // Rebuild to start if not frame 0
              if (start > 0) {
                for (let i = 0; i <= start; i++) {
                  this.scene.applyFrame(
                    this.resourceStore,
                    this.sprite.timeline[i]
                  );
                }
              }
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
          if (this.playableCount > 0) {
            this.frameIndex = this.clampFrame(result.jumpToFrame);
            this.applyCurrentFrame(recursionDepth + 1);
            return;
          }
        }
      }
    }

    this.onFrameChanged?.(frame, this.scene, this.frameIndex);
  }
}
