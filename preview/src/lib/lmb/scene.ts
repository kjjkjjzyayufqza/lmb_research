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
import { ActionInterpreter } from "./actions";

/**
 * Scene manages the display list for a single sprite timeline.
 * It applies frame operations (place / move / remove) and
 * recursively manages nested sprite instances.
 */
export class Scene {
  private instances = new Map<number, DisplayInstance & { childScene?: Scene }>();
  private nestedSpriteInstances = new Map<number, NestedSpriteInstance>();

  applyFrame(resourceStore: ResourceStore, frame: FrameDef): void {
    // 1. Handle removals
    for (const rem of frame.removeList) {
      if (this.instances.has(rem.depth)) {
        const inst = this.instances.get(rem.depth)!;
        if (this.nestedSpriteInstances.has(inst.placementId)) {
          this.nestedSpriteInstances.delete(inst.placementId);
        }
        this.instances.delete(rem.depth);
      }
    }

    // 2. Handle display list (place / move)
    for (const po of frame.displayList) {
      const isMove = po.placementMode === "move" || po.placementMode === "MOVE";
      const existing = this.instances.get(po.depth);
      const sprite = resourceStore.getSpriteById(po.characterId);

      if (isMove && existing && existing.characterId === po.characterId) {
        // MOVE: update properties of existing instance
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
      } else {
        // PLACE: create new instance (or replace existing)
        let childScene: Scene | undefined;

        if (sprite) {
          let nested = this.nestedSpriteInstances.get(po.placementId);
          if (!nested || nested.sprite.characterId !== sprite.characterId) {
            nested = {
              placementId: po.placementId,
              characterId: po.characterId,
              sprite,
              scene: new Scene(),
              frameIndex: 0,
            };
            this.nestedSpriteInstances.set(po.placementId, nested);
            if (sprite.timeline.length > 0) {
              nested.scene.applyFrame(resourceStore, sprite.timeline[0]);
            }
          }
          childScene = nested.scene;
        }

        const transform = resourceStore.getTransformFromPlaceObject(po);
        const colorMult = resourceStore.getColorById(po.colorMultId);
        const colorAdd = resourceStore.getColorById(po.colorAddId);
        const graphic = !sprite
          ? resourceStore.getGraphicForCharacter(po.characterId)
          : undefined;
        const text = !sprite && !graphic
          ? resourceStore.getTextForCharacter(po.characterId)
          : undefined;

        // Use boundsId from the sprite definition when available,
        // otherwise fall back to the characterId (for non-sprite placements).
        const boundsId = sprite ? sprite.boundsId : po.characterId;
        const bounds = resourceStore.getBoundsById(boundsId);

        this.instances.set(po.depth, {
          placementId: po.placementId,
          characterId: po.characterId,
          depth: po.depth,
          transform,
          colorMult,
          colorAdd,
          blendMode: po.blendMode,
          graphic,
          text,
          bounds,
          childScene,
        });
      }
    }
  }

  reset(): void {
    this.instances.clear();
    this.nestedSpriteInstances.clear();
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
            const result = ActionInterpreter.execute(action, nested.sprite);
            if (result.playing === false) {
              nested.stopped = true;
              remaining = 0;
              break;
            }
            if (result.jumpToFrame !== undefined) {
              const target = Math.max(0, Math.min(result.jumpToFrame, playable - 1));
              nested.frameIndex = target;
              // Re-apply the jumped-to frame
              const jumpedFrame = nested.sprite.timeline[target];
              nested.scene.applyFrame(resourceStore, jumpedFrame);
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
    for (const inst of this.instances.values()) {
      this.collectInstancesRecursive(
        inst,
        IDENTITY_TRANSFORM,
        undefined,
        undefined,
        inst.depth,
        result
      );
    }
    return result.sort((a, b) => a.depth - b.depth);
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
    baseDepth: number,
    output: DisplayInstance[]
  ): void {
    const worldTransform = multiplyTransforms(parentTransform, instance.transform);
    const worldColorMult = combineColorMult(parentColorMult, instance.colorMult);
    const worldColorAdd = combineColorAdd(parentColorAdd, instance.colorAdd);

    if (instance.graphic || instance.text) {
      output.push({
        placementId: instance.placementId,
        characterId: instance.characterId,
        depth: baseDepth,
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

    for (const child of childScene.instances.values()) {
      const childDepth = baseDepth * 1000 + child.depth;
      this.collectInstancesRecursive(
        child as DisplayInstance & { childScene?: Scene },
        worldTransform,
        worldColorMult,
        worldColorAdd,
        childDepth,
        output
      );
    }
  }
}
