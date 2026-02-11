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
      const canReuse =
        existing != null && existing.characterId === po.characterId && (isPlace || isMove);

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
            nested.scene.applyFrame(resourceStore, sprite.timeline[0]);
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

  private collectInstancesRecursive(
    instance: DisplayInstance & { childScene?: Scene },
    parentTransform: TransformMatrix,
    parentColorMult: ColorRgba | undefined,
    parentColorAdd: ColorRgba | undefined,
    output: DisplayInstance[]
  ): void {
    const worldTransform = multiplyTransforms(parentTransform, instance.transform);
    const worldColorMult = combineColorMult(parentColorMult, instance.colorMult);
    const worldColorAdd = combineColorAdd(parentColorAdd, instance.colorAdd);

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
      this.collectInstancesRecursive(
        child as DisplayInstance & { childScene?: Scene },
        worldTransform,
        worldColorMult,
        worldColorAdd,
        output
      );
    }
  }
}
