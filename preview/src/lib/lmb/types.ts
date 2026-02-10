// ============================================================
// Core LMB data types shared across runtime, editor, and renderer
// ============================================================

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
  characterId: number;
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
  unknowns?: unknown[];
}

export interface TimelineDef {
  rootSpriteId: number;
}

export interface ActionScriptEntry {
  actionId: number;
  byteLength: number;
  bytecodes: number[];
}

export interface LmbJson {
  meta: MetaDef;
  resources: ResourcesDef;
  definitions: DefinitionsDef;
  timeline: TimelineDef;
  actionScripts?: ActionScriptEntry[];
}

// ============================================================
// Display / rendering types
// ============================================================

export interface DisplayInstance {
  placementId: number;
  characterId: number;
  depth: number;
  transform: TransformMatrix;
  colorMult?: ColorRgba;
  colorAdd?: ColorRgba;
  blendMode: string;
  graphic?: GraphicDef;
  text?: TextDef;
  bounds?: BoundsDef;
}

export interface NestedSpriteInstance {
  placementId: number;
  characterId: number;
  sprite: SpriteDef;
  scene: import("./scene").Scene;
  frameIndex: number;
  /** When true the nested sprite has been halted by a stop() action. */
  stopped?: boolean;
}

// ============================================================
// Transform / color math helpers
// ============================================================

export const IDENTITY_TRANSFORM: TransformMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  x: 0,
  y: 0,
};

export function multiplyTransforms(
  parent: TransformMatrix,
  local: TransformMatrix
): TransformMatrix {
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    x: parent.a * local.x + parent.c * local.y + parent.x,
    y: parent.b * local.x + parent.d * local.y + parent.y,
  };
}

export function combineColorMult(
  parent: ColorRgba | undefined,
  local: ColorRgba | undefined
): ColorRgba | undefined {
  if (!parent && !local) return undefined;
  if (!parent) return local;
  if (!local) return parent;
  return {
    r: Math.max(0, Math.min(255, Math.floor((parent.r * local.r) / 256))),
    g: Math.max(0, Math.min(255, Math.floor((parent.g * local.g) / 256))),
    b: Math.max(0, Math.min(255, Math.floor((parent.b * local.b) / 256))),
    a: Math.max(0, Math.min(255, Math.floor((parent.a * local.a) / 256))),
  };
}

export function combineColorAdd(
  parent: ColorRgba | undefined,
  local: ColorRgba | undefined
): ColorRgba | undefined {
  if (!parent && !local) return undefined;
  if (!parent) return local;
  if (!local) return parent;
  return {
    r: Math.max(0, Math.min(255, parent.r + local.r)),
    g: Math.max(0, Math.min(255, parent.g + local.g)),
    b: Math.max(0, Math.min(255, parent.b + local.b)),
    a: Math.max(0, Math.min(255, parent.a + local.a)),
  };
}
