export interface Vec2 {
  x: number;
  y: number;
}

export interface ColorRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface TransformMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  x: number;
  y: number;
}

export interface TextureAtlasDef {
  id: number;
  nameSymbolId: number;
  name?: string;
  width: number;
  height: number;
}

export interface GraphicVertex {
  x: number;
  y: number;
  u: number;
  v: number;
}

export interface GraphicDef {
  atlasId: number;
  fillType: number;
  vertices: GraphicVertex[];
  indices: number[];
}

export interface PlaceObjectAction {
  type: "placeObject";
  characterId: number;
  placementId: number;
  depth: number;
  nameId: number;
  placementMode: string;
  blendMode: string;
  positionId: number;
  positionFlags: number;
  colorMultId: number;
  colorAddId: number;
  hasColorMatrix: boolean;
  hasUnknownF014: boolean;
}

export interface RemoveObjectAction {
  type: "removeObject";
  depth: number;
}

export interface DoAction {
  type: "doAction";
  actionId: number;
}

export interface FrameDef {
  frameIndex: number;
  isKeyframe: boolean;
  label?: string;
  displayList: PlaceObjectAction[];
  actions: DoAction[];
  removeList: RemoveObjectAction[];
}

export interface SpriteDef {
  characterId: number;
  nameSymbolId: number;
  name?: string;
  boundsId: number;
  numFrames: number;
  numKeyframes: number;
  numFrameLabels: number;
  frameLabels: Record<string, number>;
  timeline: FrameDef[];
}

export interface TextDef {
  characterId: number;
  placeholderTextId: number;
  placeholderText?: string;
  strokeColorId: number;
  alignment: number;
  size: number;
}

export interface ButtonDef {
  characterId: number;
  trackAsMenu: boolean;
  boundsId: number;
  actionOffset: number;
  graphics: GraphicDef[];
}

export interface BoundsDef {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MetaDef {
  magic: string;
  textureId: number;
  resourceId: number;
  totalFileLen: number;
  width: number;
  height: number;
  framerate: number;
  unknown?: Record<string, unknown>;
}

export interface ResourcesDef {
  symbols: { id: number; value: string }[];
  colors: ColorRgba[];
  transforms: TransformMatrix[];
  positions: Vec2[];
  bounds: BoundsDef[];
  textureAtlases: TextureAtlasDef[];
}

export interface DefinitionsDef {
  sprites: SpriteDef[];
  texts: TextDef[];
  buttons: ButtonDef[];
  graphics: GraphicDef[];
  unknowns?: any[];
}

export interface TimelineDef {
  rootSpriteId: number;
}

export interface LmbJson {
  meta: MetaDef;
  resources: ResourcesDef;
  definitions: DefinitionsDef;
  timeline: TimelineDef;
}

export interface DisplayInstance {
  placementId: number;
  characterId: number;
  depth: number;
  transform: TransformMatrix;
  colorMult?: ColorRgba;
  colorAdd?: ColorRgba;
  blendMode: string;
  graphic?: GraphicDef;
  bounds?: BoundsDef;
}

interface NestedSpriteInstance {
  placementId: number;
  characterId: number;
  sprite: SpriteDef;
  scene: Scene;
  frameIndex: number;
}

function multiplyTransforms(parent: TransformMatrix, local: TransformMatrix): TransformMatrix {
  const a = parent.a * local.a + parent.c * local.b;
  const b = parent.b * local.a + parent.d * local.b;
  const c = parent.a * local.c + parent.c * local.d;
  const d = parent.b * local.c + parent.d * local.d;
  const x = parent.a * local.x + parent.c * local.y + parent.x;
  const y = parent.b * local.x + parent.d * local.y + parent.y;

  return { a, b, c, d, x, y };
}

function combineColorMult(parent: ColorRgba | undefined, local: ColorRgba | undefined): ColorRgba | undefined {
  if (!parent && !local) {
    return undefined;
  }
  if (!parent) {
    return local;
  }
  if (!local) {
    return parent;
  }
  return {
    r: Math.max(0, Math.min(255, Math.floor((parent.r * local.r) / 256))),
    g: Math.max(0, Math.min(255, Math.floor((parent.g * local.g) / 256))),
    b: Math.max(0, Math.min(255, Math.floor((parent.b * local.b) / 256))),
    a: Math.max(0, Math.min(255, Math.floor((parent.a * local.a) / 256))),
  };
}

function combineColorAdd(parent: ColorRgba | undefined, local: ColorRgba | undefined): ColorRgba | undefined {
  if (!parent && !local) {
    return undefined;
  }
  if (!parent) {
    return local;
  }
  if (!local) {
    return parent;
  }
  return {
    r: Math.max(0, Math.min(255, parent.r + local.r)),
    g: Math.max(0, Math.min(255, parent.g + local.g)),
    b: Math.max(0, Math.min(255, parent.b + local.b)),
    a: Math.max(0, Math.min(255, parent.a + local.a)),
  };
}

export class ResourceStore {
  readonly json: LmbJson;
  private spriteById: Map<number, SpriteDef> = new Map();
  private graphicByCharacterId: Map<number, GraphicDef> = new Map();
  private boundsById: Map<number, BoundsDef> = new Map();
  private buttonByCharacterId: Map<number, ButtonDef> = new Map();

  constructor(json: LmbJson) {
    this.json = json;
    for (const s of json.definitions.sprites) {
      this.spriteById.set(s.characterId, s);
    }
    for (const g of json.definitions.graphics) {
      if ((g as any).characterId != null) {
        this.graphicByCharacterId.set((g as any).characterId, g);
      }
    }
    for (const btn of json.definitions.buttons) {
      this.buttonByCharacterId.set(btn.characterId, btn);
    }
    for (const b of json.resources.bounds) {
      this.boundsById.set(b.id, b);
    }
  }

  getMeta(): MetaDef {
    return this.json.meta;
  }

  getSprites(): SpriteDef[] {
    return this.json.definitions.sprites;
  }

  getSpriteById(id: number): SpriteDef | undefined {
    return this.spriteById.get(id);
  }

  getGraphicForCharacter(characterId: number): GraphicDef | undefined {
    const direct = this.graphicByCharacterId.get(characterId);
    if (direct) {
      return direct;
    }
    const button = this.buttonByCharacterId.get(characterId);
    if (button && button.graphics && button.graphics.length > 0) {
      return button.graphics[0];
    }
    return undefined;
  }

  getBoundsById(id: number): BoundsDef | undefined {
    return this.boundsById.get(id);
  }

  getColorById(id: number): ColorRgba | undefined {
    if (id < 0) {
      return undefined;
    }
    return this.json.resources.colors[id];
  }

  getTransformFromPlaceObject(action: PlaceObjectAction): TransformMatrix {
    const posId = action.positionId;
    const flags = action.positionFlags;

    if (posId < 0) {
      return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    }

    // Respect position_flags from the original LMB:
    // 0x0000: transform  -> position_id indexes transforms table
    // 0x8000: position   -> position_id indexes positions table
    // 0xffff: no_transform -> identity matrix
    if (flags === 0x0000) {
      const t = this.json.resources.transforms[posId];
      if (t) {
        return t;
      }
      return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    }

    if (flags === 0x8000) {
      const pos = this.json.resources.positions[posId];
      if (pos) {
        return { a: 1, b: 0, c: 0, d: 1, x: pos.x, y: pos.y };
      }
      return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    }

    if (flags === 0xffff) {
      return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    }

    // Fallback for unexpected flags: try transform, then position.
    const t = this.json.resources.transforms[posId];
    if (t) {
      return t;
    }
    const pos = this.json.resources.positions[posId];
    if (pos) {
      return { a: 1, b: 0, c: 0, d: 1, x: pos.x, y: pos.y };
    }
    return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  }
}

export class Scene {
  private instances: Map<number, DisplayInstance> = new Map();
  private nestedSpriteInstances: Map<number, NestedSpriteInstance> = new Map();

  applyFrame(resourceStore: ResourceStore, frame: FrameDef): void {
    for (const rem of frame.removeList) {
      this.instances.delete(rem.depth);
      for (const [placementId, nested] of this.nestedSpriteInstances.entries()) {
        if (nested && this.instances.has(rem.depth)) {
          const inst = this.instances.get(rem.depth);
          if (inst && inst.placementId === placementId) {
            this.nestedSpriteInstances.delete(placementId);
          }
        }
      }
    }

    for (const po of frame.displayList) {
      const transform = resourceStore.getTransformFromPlaceObject(po);
      const colorMult = resourceStore.getColorById(po.colorMultId);
      const colorAdd = resourceStore.getColorById(po.colorAddId);
      const sprite = resourceStore.getSpriteById(po.characterId);
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
            const initialFrame = sprite.timeline[0];
            nested.scene.applyFrame(resourceStore, initialFrame);
          }
        }
        const containerInstance: DisplayInstance & { childScene?: Scene } = {
          placementId: po.placementId,
          characterId: po.characterId,
          depth: po.depth,
          transform,
          colorMult,
          colorAdd,
          blendMode: po.blendMode,
          graphic: undefined,
          bounds: undefined,
          childScene: nested.scene,
        };
        this.instances.set(po.depth, containerInstance);
      } else {
        const graphic = resourceStore.getGraphicForCharacter(po.characterId);
        const bounds = resourceStore.getBoundsById(po.characterId);

        const instance: DisplayInstance = {
          placementId: po.placementId,
          characterId: po.characterId,
          depth: po.depth,
          transform,
          colorMult,
          colorAdd,
          blendMode: po.blendMode,
          graphic,
          bounds,
        };

        this.instances.set(po.depth, instance);
      }
    }
  }

  advanceNestedSprites(resourceStore: ResourceStore, framesToAdvance: number): void {
    if (framesToAdvance <= 0) {
      return;
    }
    for (const nested of this.nestedSpriteInstances.values()) {
      if (!nested.sprite.timeline.length) {
        continue;
      }
      nested.frameIndex = (nested.frameIndex + framesToAdvance) % nested.sprite.timeline.length;
      const frame = nested.sprite.timeline[nested.frameIndex];
      nested.scene.applyFrame(resourceStore, frame);
      nested.scene.advanceNestedSprites(resourceStore, framesToAdvance);
    }
  }

  getInstancesSorted(): DisplayInstance[] {
    const result: DisplayInstance[] = [];
    const identityTransform: TransformMatrix = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };

    for (const inst of this.instances.values()) {
      this.collectInstancesRecursive(
        inst as DisplayInstance & { childScene?: Scene },
        identityTransform,
        undefined,
        undefined,
        inst.depth,
        result
      );
    }

    return result.sort((a, b) => a.depth - b.depth);
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

    if (instance.graphic) {
      output.push({
        placementId: instance.placementId,
        characterId: instance.characterId,
        depth: baseDepth,
        transform: worldTransform,
        colorMult: worldColorMult,
        colorAdd: worldColorAdd,
        blendMode: instance.blendMode,
        graphic: instance.graphic,
        bounds: instance.bounds,
      });
    }

    const childScene = instance.childScene;
    if (!childScene) {
      return;
    }

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

export class TimelinePlayer {
  private resourceStore: ResourceStore;
  private sprite: SpriteDef;
  private scene: Scene;
  private frameIndex = 0;
  private playing = false;
  private lastTime = 0;
  private frameDurationMs: number;
  private onFrameChanged?: (frame: FrameDef | undefined, scene: Scene) => void;

  constructor(
    resourceStore: ResourceStore,
    sprite: SpriteDef,
    scene: Scene,
    onFrameChanged?: (frame: FrameDef | undefined, scene: Scene) => void
  ) {
    this.resourceStore = resourceStore;
    this.sprite = sprite;
    this.scene = scene;
    this.frameDurationMs = 1000 / Math.max(1, resourceStore.getMeta().framerate || 30);
    this.onFrameChanged = onFrameChanged;
  }

  play(): void {
    if (this.playing) return;
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
    this.applyCurrentFrame();
  }

  getCurrentFrameIndex(): number {
    return this.frameIndex;
  }

  getCurrentFrame(): FrameDef | undefined {
    return this.sprite.timeline[this.frameIndex];
  }

  private tick = (now: number): void => {
    if (!this.playing) {
      return;
    }

    const delta = now - this.lastTime;
    if (delta >= this.frameDurationMs) {
      const framesToAdvance = Math.floor(delta / this.frameDurationMs);
      this.lastTime = now;

      this.frameIndex = (this.frameIndex + framesToAdvance) % Math.max(1, this.sprite.timeline.length);
      this.applyCurrentFrame();
      this.scene.advanceNestedSprites(this.resourceStore, framesToAdvance);
    }

    requestAnimationFrame(this.tick);
  };

  private applyCurrentFrame(): void {
    const frame = this.getCurrentFrame();
    if (!frame) {
      return;
    }
    this.scene.applyFrame(this.resourceStore, frame);
    if (this.onFrameChanged) {
      this.onFrameChanged(frame, this.scene);
    }
  }
}

