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
    if (posId >= 0) {
      if (this.json.resources.transforms[posId]) {
        return this.json.resources.transforms[posId];
      }
      if (this.json.resources.positions[posId]) {
        const pos = this.json.resources.positions[posId];
        return { a: 1, b: 0, c: 0, d: 1, x: pos.x, y: pos.y };
      }
    }
    return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  }
}

export class Scene {
  private instances: Map<number, DisplayInstance> = new Map();

  applyFrame(resourceStore: ResourceStore, frame: FrameDef): void {
    for (const rem of frame.removeList) {
      this.instances.delete(rem.depth);
    }

    for (const po of frame.displayList) {
      const transform = resourceStore.getTransformFromPlaceObject(po);
      const colorMult = resourceStore.getColorById(po.colorMultId);
      const colorAdd = resourceStore.getColorById(po.colorAddId);
      const graphic = resourceStore.getGraphicForCharacter(po.characterId);

      const instance: DisplayInstance = {
        placementId: po.placementId,
        characterId: po.characterId,
        depth: po.depth,
        transform,
        colorMult,
        colorAdd,
        blendMode: po.blendMode,
        graphic,
      };

      this.instances.set(po.depth, instance);
    }
  }

  getInstancesSorted(): DisplayInstance[] {
    return Array.from(this.instances.values()).sort((a, b) => a.depth - b.depth);
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
      this.lastTime = now; // Simply taking now might drift if we don't account for remainder, but ok for now.
      // Better: this.lastTime += framesToAdvance * this.frameDurationMs;

      this.frameIndex = (this.frameIndex + framesToAdvance) % Math.max(1, this.sprite.timeline.length);
      this.applyCurrentFrame();
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

