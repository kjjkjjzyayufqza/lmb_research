import {
  type DisplayInstance,
  type NestedSpriteInstance,
  type FrameDef,
  type TransformMatrix,
  type ColorRgba,
  IDENTITY_TRANSFORM,
  multiplyTransforms,
  combineColorMult,
  combineColorAdd,
} from "./types";
import { ResourceStore } from "./store";
import { ActionInterpreter, type AS2ExecutionContext } from "./actions";

/**
 * Tree node describing a nested sprite instance and its children,
 * used by the SpriteTreePanel UI component.
 */
export interface NestedSpriteTreeNode {
  /** Placement ID (unique per instance in display list). */
  placementId: number;
  /** Instance name (from PlaceObject nameId). */
  name: string;
  /** Character ID of the sprite. */
  characterId: number;
  /** Current frame index (0-based). */
  frameIndex: number;
  /** Total number of playable frames. */
  numFrames: number;
  /** Whether the sprite is currently stopped. */
  stopped: boolean;
  /** Frame labels mapping (label -> frameIndex). */
  labels: Record<string, number>;
  /** Alpha override set by AS2 (0-100) or undefined if not set. */
  alphaOverride?: number;
  /** Visibility override set by AS2 or undefined if not set. */
  visibleOverride?: boolean;
  /** Nested children of this sprite. */
  children: NestedSpriteTreeNode[];
}

/**
 * Scene manages the display list for a single sprite timeline.
 * It applies frame operations (place / move / remove) and
 * recursively manages nested sprite instances.
 */
export class Scene {
  private instances = new Map<number, DisplayInstance & { childScene?: Scene }>();
  private nestedSpriteInstances = new Map<number, NestedSpriteInstance>();
  /** Name-based index into nestedSpriteInstances (built during applyFrame). */
  private nestedByName = new Map<string, NestedSpriteInstance>();

  /**
   * Look up a nested sprite instance by its instance name.
   * Instance names come from the PlaceObject nameId field.
   */
  getNestedByName(name: string): NestedSpriteInstance | undefined {
    return this.nestedByName.get(name);
  }

  applyFrame(resourceStore: ResourceStore, frame: FrameDef): void {
    // 1. Handle removals
    for (const rem of frame.removeList) {
      if (this.instances.has(rem.depth)) {
        const inst = this.instances.get(rem.depth)!;
        const nested = this.nestedSpriteInstances.get(inst.placementId);
        if (nested) {
          if (nested.name) this.nestedByName.delete(nested.name);
          this.nestedSpriteInstances.delete(inst.placementId);
        }
        this.instances.delete(rem.depth);
      }
    }

    // 2. Handle display list (place / move)
    for (const po of frame.displayList) {
      const mode = String(po.placementMode || "").toLowerCase();
      const isPlace = mode === "place";
      const isMove = mode === "move";
      const existing = this.instances.get(po.depth);
      const sprite = resourceStore.getSpriteById(po.characterId);

      // Engine behavior summary (from reverse-engineering):
      // - place: reuse instance if character matches, otherwise replace
      // - move: carry over previous instance state, then override fields present in this tag
      //   characterId=0 in MOVE means "keep existing character" (no character change)
      const effectiveCharId = isMove && po.characterId === 0 && existing != null
        ? existing.characterId
        : po.characterId;
      const canReuse =
        existing != null && existing.characterId === effectiveCharId && (isPlace || isMove);

      if (canReuse) {
        // Reuse: update only fields that are explicitly present.
        if (po.positionFlags !== 0xffff) {
          existing.transform = resourceStore.getTransformFromPlaceObject(po);
        }
        if (po.colorMultId !== -1) {
          existing.colorMult = resourceStore.getColorById(po.colorMultId);
        }
        if (po.colorAddId !== -1) {
          existing.colorAdd = resourceStore.getColorById(po.colorAddId);
        }
        if (po.blendMode && po.blendMode !== "UNKNOWN") {
          existing.blendMode = po.blendMode;
        }
        this.instances.set(po.depth, existing);
        continue;
      }

      // Replace or place a new instance.
      // If this is MOVE over an existing instance with a different character,
      // approximate the engine's "carryover then override" by seeding defaults
      // from the previous instance when the tag indicates "no change".
      const seedFromExisting = isMove && existing != null;
      const seededTransform =
        seedFromExisting && po.positionFlags === 0xffff
          ? existing.transform
          : resourceStore.getTransformFromPlaceObject(po);
      const seededColorMult =
        seedFromExisting && po.colorMultId === -1
          ? existing.colorMult
          : resourceStore.getColorById(po.colorMultId);
      const seededColorAdd =
        seedFromExisting && po.colorAddId === -1
          ? existing.colorAdd
          : resourceStore.getColorById(po.colorAddId);
      const seededBlendMode =
        seedFromExisting &&
        (!po.blendMode || po.blendMode === "UNKNOWN")
          ? existing.blendMode
          : po.blendMode;

      // If we are replacing an old instance, clean up nested sprite tracking.
      if (existing) {
        const oldNested = this.nestedSpriteInstances.get(existing.placementId);
        if (oldNested) {
          if (oldNested.name) this.nestedByName.delete(oldNested.name);
          this.nestedSpriteInstances.delete(existing.placementId);
        }
      }

      let childScene: Scene | undefined;
      if (sprite) {
        let nested = this.nestedSpriteInstances.get(po.placementId);
        if (!nested || nested.sprite.characterId !== sprite.characterId) {
          // Resolve instance name from nameId (symbol table index)
          const instanceName = po.nameId >= 0
            ? resourceStore.getSymbolById(po.nameId)
            : undefined;

          nested = {
            placementId: po.placementId,
            characterId: po.characterId,
            sprite,
            scene: new Scene(),
            frameIndex: 0,
            name: instanceName,
          };
          this.nestedSpriteInstances.set(po.placementId, nested);

          // Register in name-based index
          if (instanceName) {
            this.nestedByName.set(instanceName, nested);
          }

          if (sprite.timeline.length > 0) {
            const frame0 = sprite.timeline[0];
            nested.scene.applyFrame(resourceStore, frame0);

            // Execute frame 0 actions (e.g. stop() on the initial frame).
            // Without this, nested sprites that begin with stop() would
            // incorrectly stay in the "playing" state.
            if (frame0.actions.length > 0) {
              for (const act of frame0.actions) {
                const actResult = ActionInterpreter.execute(
                  act, sprite, resourceStore,
                  { sprite, scene: nested.scene, resourceStore },
                );
                if (actResult.playing === false) {
                  nested.stopped = true;
                }
                if (actResult.playing === true) {
                  nested.stopped = false;
                }
                if (actResult.jumpToFrame !== undefined) {
                  const playableN = sprite.numFrames > 0
                    ? sprite.numFrames : sprite.timeline.length;
                  const target = Math.max(0, Math.min(actResult.jumpToFrame, playableN - 1));
                  nested.frameIndex = target;
                  nested.scene.reset();
                  for (let fi = 0; fi <= target; fi++) {
                    if (fi > 0) {
                      nested.scene.advanceNestedSprites(resourceStore, 1);
                    }
                    nested.scene.applyFrame(resourceStore, sprite.timeline[fi]);
                  }
                }
              }
            }
          }
        }
        childScene = nested.scene;
      }

      const graphic = !sprite
        ? resourceStore.getGraphicForCharacter(po.characterId)
        : undefined;
      const text = !sprite && !graphic
        ? resourceStore.getTextForCharacter(po.characterId)
        : undefined;
      const boundsId = sprite ? sprite.boundsId : po.characterId;
      const bounds = resourceStore.getBoundsById(boundsId);

      this.instances.set(po.depth, {
        placementId: po.placementId,
        characterId: po.characterId,
        depth: po.depth,
        transform: seededTransform,
        colorMult: seededColorMult,
        colorAdd: seededColorAdd,
        blendMode: seededBlendMode,
        graphic,
        text,
        bounds,
        childScene,
      });
    }
  }

  reset(): void {
    this.instances.clear();
    this.nestedSpriteInstances.clear();
    this.nestedByName.clear();
  }

  duplicateMovieClip(sourceName: string, targetName: string, depth: number, resourceStore: ResourceStore): void {
    const sourceNested = this.nestedByName.get(sourceName);
    if (!sourceNested) return;

    const sprite = sourceNested.sprite;
    const newScene = new Scene();
    const placementId = 10000 + depth;

    if (sprite.timeline.length > 0) {
      newScene.applyFrame(resourceStore, sprite.timeline[0]);
    }

    const cloned: NestedSpriteInstance = {
      placementId,
      characterId: sourceNested.characterId,
      sprite,
      scene: newScene,
      frameIndex: 0,
      name: targetName,
    };

    this.nestedSpriteInstances.set(placementId, cloned);
    this.nestedByName.set(targetName, cloned);

    // Also create a display instance at the specified depth,
    // inheriting transform from the source instance.
    const sourceInstance = [...this.instances.values()].find(
      inst => inst.placementId === sourceNested.placementId
    );
    if (sourceInstance) {
      this.instances.set(depth, {
        placementId,
        characterId: sourceNested.characterId,
        depth,
        transform: { ...sourceInstance.transform },
        colorMult: sourceInstance.colorMult ? { ...sourceInstance.colorMult } : undefined,
        colorAdd: sourceInstance.colorAdd ? { ...sourceInstance.colorAdd } : undefined,
        blendMode: sourceInstance.blendMode,
        graphic: sourceInstance.graphic,
        text: sourceInstance.text,
        bounds: sourceInstance.bounds,
        childScene: newScene,
      });
    }
  }

  removeMovieClip(name: string): void {
    const nested = this.nestedByName.get(name);
    if (!nested) return;
    this.nestedByName.delete(name);
    this.nestedSpriteInstances.delete(nested.placementId);
    for (const [depth, inst] of this.instances) {
      if (inst.placementId === nested.placementId) {
        this.instances.delete(depth);
        break;
      }
    }
  }

  /**
   * Advance all nested sprite instances by the given number of frames.
   *
   * Each nested sprite has its own independent timeline.  Only the
   * first `numFrames` entries in the timeline are playable; the
   * trailing keyframes are skipped.  Frame actions (e.g. stop()) are
   * honoured: when a nested sprite hits a stop() action it freezes
   * on its current frame until explicitly restarted.
   */
  advanceNestedSprites(resourceStore: ResourceStore, framesToAdvance: number): void {
    if (framesToAdvance <= 0) return;
    for (const nested of this.nestedSpriteInstances.values()) {
      const playable = nested.sprite.numFrames > 0
        ? nested.sprite.numFrames
        : nested.sprite.timeline.length;
      if (playable === 0) continue;

      // If this nested sprite was previously stopped by an action,
      // keep it frozen.
      if (nested.stopped) {
        continue;
      }

      let remaining = framesToAdvance;
      while (remaining > 0) {
        const nextFrame = (nested.frameIndex + 1) % playable;
        nested.frameIndex = nextFrame;
        remaining -= 1;

        const frame = nested.sprite.timeline[nested.frameIndex];
        nested.scene.applyFrame(resourceStore, frame);

        // Process actions for this nested frame
        if (frame.actions.length > 0) {
          for (const action of frame.actions) {
            const result = ActionInterpreter.execute(action, nested.sprite, resourceStore, {
              sprite: nested.sprite,
              scene: nested.scene,
              resourceStore,
            });
            if (result.playing === false) {
              nested.stopped = true;
              remaining = 0;
              break;
            }
            if (result.playing === true) {
              nested.stopped = false;
            }
            if (result.jumpToFrame !== undefined) {
              const target = Math.max(0, Math.min(result.jumpToFrame, playable - 1));
              nested.frameIndex = target;
              // Re-apply the jumped-to frame via scene reset + replay for deterministic state
              nested.scene.reset();
              for (let fi = 0; fi <= target; fi++) {
                if (fi > 0) {
                  nested.scene.advanceNestedSprites(resourceStore, 1);
                }
                nested.scene.applyFrame(resourceStore, nested.sprite.timeline[fi]);
              }
            }
          }
        }
      }

      // Recursively advance grandchild sprites
      nested.scene.advanceNestedSprites(resourceStore, framesToAdvance);
    }
  }

  /**
   * Return a flat, depth-sorted list of all renderable instances,
   * recursively flattening nested sprite children.
   */
  getInstancesSorted(): DisplayInstance[] {
    const result: DisplayInstance[] = [];
    const roots = [...this.instances.values()].sort((a, b) => a.depth - b.depth);
    for (const inst of roots) {
      this.collectInstancesRecursive(
        inst,
        IDENTITY_TRANSFORM,
        undefined,
        undefined,
        result
      );
    }
    return result;
  }

  /**
   * Return the raw instance map (depth -> instance) for editor inspection.
   */
  getRawInstances(): Map<number, DisplayInstance> {
    return this.instances as Map<number, DisplayInstance>;
  }

  /**
   * Return an iterator over all nested sprite instances at this level.
   * Used by the SpriteTreePanel for direct access.
   */
  getNestedSpriteInstances(): IterableIterator<NestedSpriteInstance> {
    return this.nestedSpriteInstances.values();
  }

  /**
   * Build a tree representation of all nested sprite instances,
   * recursively including their children.
   */
  getNestedSpriteTree(): NestedSpriteTreeNode[] {
    const nodes: NestedSpriteTreeNode[] = [];
    for (const nested of this.nestedSpriteInstances.values()) {
      const playable = nested.sprite.numFrames > 0
        ? nested.sprite.numFrames
        : nested.sprite.timeline.length;
      nodes.push({
        placementId: nested.placementId,
        name: nested.name ?? `placement_${nested.placementId}`,
        characterId: nested.characterId,
        frameIndex: nested.frameIndex,
        numFrames: playable,
        stopped: nested.stopped ?? false,
        labels: { ...nested.sprite.frameLabels },
        alphaOverride: nested.alphaOverride,
        visibleOverride: nested.visibleOverride,
        children: nested.scene.getNestedSpriteTree(),
      });
    }
    return nodes;
  }

  /**
   * Find a nested sprite instance by placementId, searching recursively
   * through all child scenes.
   */
  findNestedByPlacementId(placementId: number): NestedSpriteInstance | undefined {
    const direct = this.nestedSpriteInstances.get(placementId);
    if (direct) return direct;
    for (const nested of this.nestedSpriteInstances.values()) {
      const found = nested.scene.findNestedByPlacementId(placementId);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Execute a playback method on a nested sprite identified by placementId.
   * Searches recursively through all child scenes.
   *
   * @param placementId    Placement ID of the nested sprite.
   * @param method         Method to call: gotoAndPlay, gotoAndStop, play, stop.
   * @param arg            Frame label (string) or frame number (1-based) for goto methods.
   * @param resourceStore  Resource store for deterministic frame rebuilding.
   * @returns true if the operation was executed, false if the sprite was not found.
   */
  executeOnNestedSprite(
    placementId: number,
    method: "gotoAndPlay" | "gotoAndStop" | "play" | "stop",
    arg: string | number | undefined,
    resourceStore: ResourceStore,
  ): boolean {
    const nested = this.findNestedByPlacementId(placementId);
    if (!nested) return false;

    const clipSprite = nested.sprite;
    const playable = clipSprite.numFrames > 0
      ? clipSprite.numFrames
      : clipSprite.timeline.length;

    switch (method) {
      case "gotoAndPlay":
      case "gotoAndStop": {
        let targetFrame = -1;
        if (typeof arg === "string") {
          const fi = clipSprite.frameLabels[arg];
          if (fi !== undefined) targetFrame = fi;
        } else if (typeof arg === "number") {
          targetFrame = arg - 1; // AS2 is 1-based
        }
        if (targetFrame < 0 || targetFrame >= playable) return false;

        nested.frameIndex = targetFrame;
        nested.stopped = method === "gotoAndStop";

        // Deterministic rebuild to target frame
        nested.scene.reset();
        for (let fi = 0; fi <= targetFrame; fi++) {
          if (fi > 0) {
            nested.scene.advanceNestedSprites(resourceStore, 1);
          }
          nested.scene.applyFrame(resourceStore, clipSprite.timeline[fi]);
        }
        return true;
      }
      case "play": {
        nested.stopped = false;
        return true;
      }
      case "stop": {
        nested.stopped = true;
        return true;
      }
    }
  }

  /**
   * Set the alpha override on a nested sprite identified by placementId.
   * Searches recursively through all child scenes.
   * @param placementId  Placement ID.
   * @param alpha        Alpha value (0-100, AS2 convention).
   */
  setNestedAlpha(placementId: number, alpha: number): boolean {
    const nested = this.findNestedByPlacementId(placementId);
    if (!nested) return false;
    nested.alphaOverride = alpha;
    return true;
  }

  /**
   * Set the visibility override on a nested sprite identified by placementId.
   * Searches recursively through all child scenes.
   * @param placementId  Placement ID.
   * @param visible      Visibility flag.
   */
  setNestedVisible(placementId: number, visible: boolean): boolean {
    const nested = this.findNestedByPlacementId(placementId);
    if (!nested) return false;
    nested.visibleOverride = visible;
    return true;
  }

  private collectInstancesRecursive(
    instance: DisplayInstance & { childScene?: Scene },
    parentTransform: TransformMatrix,
    parentColorMult: ColorRgba | undefined,
    parentColorAdd: ColorRgba | undefined,
    output: DisplayInstance[],
    ownerScene?: Scene,
  ): void {
    const worldTransform = multiplyTransforms(parentTransform, instance.transform);
    let worldColorMult = combineColorMult(parentColorMult, instance.colorMult);
    const worldColorAdd = combineColorAdd(parentColorAdd, instance.colorAdd);

    // Apply AS2 alpha/visible overrides from the nested sprite instance
    const nested = ownerScene
      ? ownerScene.nestedSpriteInstances.get(instance.placementId)
      : this.nestedSpriteInstances.get(instance.placementId);

    if (nested) {
      // If visibleOverride is explicitly false, skip the entire subtree
      if (nested.visibleOverride === false) return;

      // Apply alphaOverride: convert AS2 _alpha (0-100) to colorMult.a (0-256)
      if (nested.alphaOverride !== undefined) {
        const alphaScale = Math.max(0, Math.min(256, Math.round((nested.alphaOverride / 100) * 256)));
        const base = worldColorMult ?? { r: 256, g: 256, b: 256, a: 256 };
        worldColorMult = {
          r: base.r,
          g: base.g,
          b: base.b,
          a: Math.max(0, Math.min(255, Math.floor((base.a * alphaScale) / 256))),
        };
      }
    }

    if (instance.graphic || instance.text) {
      output.push({
        placementId: instance.placementId,
        characterId: instance.characterId,
        depth: instance.depth,
        transform: worldTransform,
        colorMult: worldColorMult,
        colorAdd: worldColorAdd,
        blendMode: instance.blendMode,
        graphic: instance.graphic,
        text: instance.text,
        bounds: instance.bounds,
      });
    }

    const childScene = instance.childScene;
    if (!childScene) return;

    const children = [...childScene.instances.values()].sort(
      (a, b) => a.depth - b.depth
    );
    for (const child of children) {
      childScene.collectInstancesRecursive(
        child as DisplayInstance & { childScene?: Scene },
        worldTransform,
        worldColorMult,
        worldColorAdd,
        output,
        childScene,
      );
    }
  }
}
