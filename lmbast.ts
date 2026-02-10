/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from 'buffer';

export type LmbAst = {
  header: LmbHeaderAst;
  tags: LmbTagAst[];
};

export type LmbHeaderAst = {
  textureId: number;
  resourceId: number;
  xmdPaddingU32: number;
  numPadding: number;
  unknown4: number;
  unknown5: number;
  totalFileLen: number;
  paddingWords: number[];
  trailingBytes: number[];
};

export type LmbTagAst =
  | { tagType: number; offset: number; words: number[]; kind: 'symbols'; data: SymbolsTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'colors'; data: ColorsTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'transforms'; data: TransformsTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'positions'; data: PositionsTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'bounds'; data: BoundsTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'textureAtlases'; data: TextureAtlasesTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'properties'; data: PropertiesTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'defines'; data: DefinesTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'defineSprite'; data: DefineSpriteTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'frameLabel'; data: FrameLabelTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'frame'; data: FrameTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'placeObject'; data: PlaceObjectTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'removeObject'; data: RemoveObjectTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'doAction'; data: DoActionTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'dynamicText'; data: DynamicTextTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'button'; data: ButtonTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'graphic'; data: GraphicTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'actionScript'; data: ActionScriptTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'fonts'; data: FontsTag; children: LmbTagAst[] }
  | { tagType: number; offset: number; words: number[]; kind: 'unknown'; data: UnknownTag; children: LmbTagAst[] };

export type SymbolsTag = { values: string[] };
export type ColorsTag = { values: { r: number; g: number; b: number; a: number }[] };
export type TransformsTag = { values: { a: number; b: number; c: number; d: number; x: number; y: number }[] };
export type PositionsTag = { values: { x: number; y: number }[] };
export type BoundsTag = { values: { x: number; y: number; width: number; height: number }[] };
export type TextureAtlasesTag = { values: { id: number; nameId: number; width: number; height: number }[] };

export type PropertiesTag = {
  unknownPrefixWords: number[]; // 3 words
  maxCharacterId: number;
  unknown2: number;
  entryCharacterId: number;
  maxDepth: number; // u2
  unknown3: number; // u2
  framerate: number; // f32
  width: number; // f32
  height: number; // f32
  unknownSuffixWords: number[]; // 2 words
};

export type DefinesTag = {
  numShapes: number;
  unknown1: number;
  numSprites: number;
  unknown2: number;
  numTexts: number;
  unknown3Words: number[]; // 3 words
};

export type DefineSpriteTag = {
  characterId: number;
  nameId: number;
  boundsId: number;
  numFrameLabels: number;
  numFrames: number;
  numKeyframes: number;
  numPlacedObjects: number;
};

export type FrameLabelTag = { nameId: number; startFrame: number };
export type FrameTag = { id: number; numChildren: number };

export type PlaceObjectTag = {
  characterId: number;
  placementId: number;
  unknown1: number;
  nameId: number;
  placementMode: number; // u2
  blendMode: number; // u2
  depth: number; // u2
  unknown2: number; // u2
  unknown3: number; // u2
  unknown4: number; // u2
  positionId: number; // s2
  positionFlags: number; // u2
  colorMultId: number; // s4
  colorAddId: number; // s4
  hasColorMatrix: number; // u4
  hasUnknownF014: number; // u4
};

export type RemoveObjectTag = { unknown1: number; depth: number; unknown2: number };
export type DoActionTag = { actionId: number; unknown: number };

export type DynamicTextTag = {
  characterId: number;
  unknown1: number;
  placeholderText: number;
  unknown2: number;
  strokeColorId: number;
  unknown3Words: number[]; // 3 words
  alignment: number; // u2
  unknown4: number; // u2
  unknown5Words: number[]; // 2 words
  size: number; // f32
  unknown6Words: number[]; // 4 words
};

export type ButtonTag = {
  characterId: number;
  trackAsMenu: boolean;
  unknownBits15: number;
  actionOffset: number; // u2
  boundsId: number;
  unknown2: number;
  numGraphics: number;
};

export type GraphicTag = {
  atlasId: number;
  fillType: number; // u2
  vertices: { x: number; y: number; u: number; v: number }[];
  indices: number[]; // u2
};

export type ActionScriptTag = { bytecodeWords: number[] };
export type FontsTag = { unknown: number };
export type UnknownTag = { words: number[] };

const TAG = {
  SHOW_FRAME: 0x0001,
  PLACE_OBJECT: 0x0004,
  REMOVE_OBJECT: 0x0005,
  FONTS: 0x000a,
  DO_ACTION: 0x000c,
  DYNAMIC_TEXT: 0x0025,
  DEFINE_SPRITE: 0x0027,
  FRAME_LABEL: 0x002b,

  SYMBOLS: 0xf001,
  COLORS: 0xf002,
  TRANSFORMS: 0xf003,
  POSITIONS: 0xf103,
  BOUNDS: 0xf004,
  ACTION_SCRIPT: 0xf005,
  ACTION_SCRIPT_2: 0xff05,
  KEYFRAME: 0xf105,
  TEXTURE_ATLASES: 0xf007,
  PROPERTIES: 0xf00c,
  DEFINES: 0xf00d,
  BUTTON: 0xf022,
  GRAPHIC: 0xf024,
} as const;

class Reader {
  private readonly buf: Buffer;
  private off: number;
  constructor(buf: Buffer, offset = 0) {
    this.buf = buf;
    this.off = offset;
  }
  get offset() {
    return this.off;
  }
  set offset(v: number) {
    if (v < 0 || v > this.buf.length) throw new Error(`Reader offset out of range: ${v}`);
    this.off = v;
  }
  ensure(n: number) {
    if (this.off + n > this.buf.length) throw new Error(`Unexpected EOF: need=${n}`);
  }
  readU1(): number {
    this.ensure(1);
    const v = this.buf.readUInt8(this.off);
    this.off += 1;
    return v;
  }
  readU2(): number {
    this.ensure(2);
    const v = this.buf.readUInt16LE(this.off);
    this.off += 2;
    return v;
  }
  readS2(): number {
    this.ensure(2);
    const v = this.buf.readInt16LE(this.off);
    this.off += 2;
    return v;
  }
  readU4(): number {
    this.ensure(4);
    const v = this.buf.readUInt32LE(this.off);
    this.off += 4;
    return v;
  }
  readS4(): number {
    this.ensure(4);
    const v = this.buf.readInt32LE(this.off);
    this.off += 4;
    return v;
  }
  readF4(): number {
    this.ensure(4);
    const v = this.buf.readFloatLE(this.off);
    this.off += 4;
    return v;
  }
  readBytes(n: number): Buffer {
    this.ensure(n);
    const out = this.buf.subarray(this.off, this.off + n);
    this.off += n;
    return out;
  }
  readU4Words(n: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(this.readU4());
    return out;
  }
}

class Writer {
  private chunks: Buffer[] = [];
  private length = 0;
  size(): number {
    return this.length;
  }
  push(b: Buffer) {
    this.chunks.push(b);
    this.length += b.length;
  }
  writeU1(v: number) {
    const b = Buffer.alloc(1);
    b.writeUInt8(v & 0xff, 0);
    this.push(b);
  }
  writeU2(v: number) {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v & 0xffff, 0);
    this.push(b);
  }
  writeS2(v: number) {
    const b = Buffer.alloc(2);
    b.writeInt16LE(v, 0);
    this.push(b);
  }
  writeU4(v: number) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v >>> 0, 0);
    this.push(b);
  }
  writeS4(v: number) {
    const b = Buffer.alloc(4);
    b.writeInt32LE(v, 0);
    this.push(b);
  }
  writeF4(v: number) {
    const b = Buffer.alloc(4);
    b.writeFloatLE(v, 0);
    this.push(b);
  }
  writeBytes(buf: Buffer) {
    this.push(buf);
  }
  writeU4Words(words: number[]) {
    for (const w of words) this.writeU4(w);
  }
  toBuffer(): Buffer {
    return Buffer.concat(this.chunks, this.length);
  }
}

function pad4(n: number): number {
  const r = n % 4;
  return r === 0 ? 0 : 4 - r;
}

function computeChildrenCount(tagType: number, payload: Buffer): number {
  const ru4 = (off: number) => {
    if (off < 0 || off + 4 > payload.length) throw new Error(`childrenCount readU4 out of range: off=${off}`);
    return payload.readUInt32LE(off);
  };

  switch (tagType) {
    case TAG.DEFINES: {
      const numShapes = ru4(0);
      const numSprites = ru4(8);
      const numTexts = ru4(16);
      return numShapes + numSprites + numTexts;
    }
    case TAG.KEYFRAME:
    case TAG.SHOW_FRAME: {
      return ru4(4);
    }
    case TAG.DEFINE_SPRITE: {
      const numFrameLabels = ru4(12);
      const numFrames = ru4(16);
      const numKeyframes = ru4(20);
      return numFrameLabels + numFrames + numKeyframes;
    }
    case TAG.BUTTON: {
      return ru4(16);
    }
    case TAG.PLACE_OBJECT: {
      const hasColorMatrix = ru4(40);
      const hasUnknownF014 = ru4(44);
      return hasColorMatrix + hasUnknownF014;
    }
    default:
      return 0;
  }
}

function decodeSymbols(payload: Buffer): SymbolsTag {
  const r = new Reader(payload, 0);
  const numValues = r.readU4();
  const values: string[] = [];
  for (let i = 0; i < numValues; i++) {
    const len = r.readU4();
    const bytes = r.readBytes(len);
    values.push(bytes.toString('utf8'));
    r.readBytes(pad4(len));
  }
  return { values };
}

function encodeSymbols(data: SymbolsTag): Buffer {
  const w = new Writer();
  w.writeU4(data.values.length);
  for (const s of data.values) {
    const bytes = Buffer.from(s, 'utf8');
    w.writeU4(bytes.length);
    w.writeBytes(bytes);
    const p = pad4(bytes.length);
    if (p) w.writeBytes(Buffer.alloc(p));
  }
  return w.toBuffer();
}

function decodeColors(payload: Buffer): ColorsTag {
  const r = new Reader(payload, 0);
  const numValues = r.readU4();
  const values: ColorsTag['values'] = [];
  for (let i = 0; i < numValues; i++) {
    const rr = r.readU2();
    const gg = r.readU2();
    const bb = r.readU2();
    const aa = r.readU2();
    values.push({ r: rr, g: gg, b: bb, a: aa });
  }
  return { values };
}

function encodeColors(data: ColorsTag): Buffer {
  const w = new Writer();
  w.writeU4(data.values.length);
  for (const c of data.values) {
    w.writeU2(c.r);
    w.writeU2(c.g);
    w.writeU2(c.b);
    w.writeU2(c.a);
  }
  return w.toBuffer();
}

function decodeTransforms(payload: Buffer): TransformsTag {
  const r = new Reader(payload, 0);
  const numValues = r.readU4();
  const values: TransformsTag['values'] = [];
  for (let i = 0; i < numValues; i++) {
    values.push({ a: r.readF4(), b: r.readF4(), c: r.readF4(), d: r.readF4(), x: r.readF4(), y: r.readF4() });
  }
  return { values };
}

function encodeTransforms(data: TransformsTag): Buffer {
  const w = new Writer();
  w.writeU4(data.values.length);
  for (const m of data.values) {
    w.writeF4(m.a);
    w.writeF4(m.b);
    w.writeF4(m.c);
    w.writeF4(m.d);
    w.writeF4(m.x);
    w.writeF4(m.y);
  }
  return w.toBuffer();
}

function decodePositions(payload: Buffer): PositionsTag {
  const r = new Reader(payload, 0);
  const numValues = r.readU4();
  const values: PositionsTag['values'] = [];
  for (let i = 0; i < numValues; i++) values.push({ x: r.readF4(), y: r.readF4() });
  return { values };
}

function encodePositions(data: PositionsTag): Buffer {
  const w = new Writer();
  w.writeU4(data.values.length);
  for (const p of data.values) {
    w.writeF4(p.x);
    w.writeF4(p.y);
  }
  return w.toBuffer();
}

function decodeBounds(payload: Buffer): BoundsTag {
  const r = new Reader(payload, 0);
  const numValues = r.readU4();
  const values: BoundsTag['values'] = [];
  for (let i = 0; i < numValues; i++) values.push({ x: r.readF4(), y: r.readF4(), width: r.readF4(), height: r.readF4() });
  return { values };
}

function encodeBounds(data: BoundsTag): Buffer {
  const w = new Writer();
  w.writeU4(data.values.length);
  for (const b of data.values) {
    w.writeF4(b.x);
    w.writeF4(b.y);
    w.writeF4(b.width);
    w.writeF4(b.height);
  }
  return w.toBuffer();
}

function decodeTextureAtlases(payload: Buffer): TextureAtlasesTag {
  const r = new Reader(payload, 0);
  const numValues = r.readU4();
  const values: TextureAtlasesTag['values'] = [];
  for (let i = 0; i < numValues; i++) {
    const id = r.readU4();
    const nameId = r.readU4();
    const width = r.readF4();
    const height = r.readF4();
    values.push({ id, nameId, width, height });
  }
  return { values };
}

function encodeTextureAtlases(data: TextureAtlasesTag): Buffer {
  const w = new Writer();
  w.writeU4(data.values.length);
  for (const t of data.values) {
    w.writeU4(t.id);
    w.writeU4(t.nameId);
    w.writeF4(t.width);
    w.writeF4(t.height);
  }
  return w.toBuffer();
}

function decodeProperties(payload: Buffer): PropertiesTag {
  const r = new Reader(payload, 0);
  const unknownPrefixWords = r.readU4Words(3);
  const maxCharacterId = r.readU4();
  const unknown2 = r.readU4();
  const entryCharacterId = r.readU4();
  const maxDepth = r.readU2();
  const unknown3 = r.readU2();
  const framerate = r.readF4();
  const width = r.readF4();
  const height = r.readF4();
  const unknownSuffixWords = r.readU4Words(2);
  return {
    unknownPrefixWords,
    maxCharacterId,
    unknown2,
    entryCharacterId,
    maxDepth,
    unknown3,
    framerate,
    width,
    height,
    unknownSuffixWords,
  };
}

function encodeProperties(data: PropertiesTag): Buffer {
  const w = new Writer();
  w.writeU4Words(data.unknownPrefixWords);
  w.writeU4(data.maxCharacterId);
  w.writeU4(data.unknown2);
  w.writeU4(data.entryCharacterId);
  w.writeU2(data.maxDepth);
  w.writeU2(data.unknown3);
  w.writeF4(data.framerate);
  w.writeF4(data.width);
  w.writeF4(data.height);
  w.writeU4Words(data.unknownSuffixWords);
  return w.toBuffer();
}

function decodeDefines(payload: Buffer): DefinesTag {
  const r = new Reader(payload, 0);
  const numShapes = r.readU4();
  const unknown1 = r.readU4();
  const numSprites = r.readU4();
  const unknown2 = r.readU4();
  const numTexts = r.readU4();
  const unknown3Words = r.readU4Words(3);
  return { numShapes, unknown1, numSprites, unknown2, numTexts, unknown3Words };
}

function encodeDefines(data: DefinesTag): Buffer {
  const w = new Writer();
  w.writeU4(data.numShapes);
  w.writeU4(data.unknown1);
  w.writeU4(data.numSprites);
  w.writeU4(data.unknown2);
  w.writeU4(data.numTexts);
  w.writeU4Words(data.unknown3Words);
  return w.toBuffer();
}

function decodeDefineSprite(payload: Buffer): DefineSpriteTag {
  const r = new Reader(payload, 0);
  return {
    characterId: r.readU4(),
    nameId: r.readU4(),
    boundsId: r.readU4(),
    numFrameLabels: r.readU4(),
    numFrames: r.readU4(),
    numKeyframes: r.readU4(),
    numPlacedObjects: r.readU4(),
  };
}

function encodeDefineSprite(data: DefineSpriteTag): Buffer {
  const w = new Writer();
  w.writeU4(data.characterId);
  w.writeU4(data.nameId);
  w.writeU4(data.boundsId);
  w.writeU4(data.numFrameLabels);
  w.writeU4(data.numFrames);
  w.writeU4(data.numKeyframes);
  w.writeU4(data.numPlacedObjects);
  return w.toBuffer();
}

function decodeFrameLabel(payload: Buffer): FrameLabelTag {
  const r = new Reader(payload, 0);
  return { nameId: r.readU4(), startFrame: r.readU4() };
}

function encodeFrameLabel(data: FrameLabelTag): Buffer {
  const w = new Writer();
  w.writeU4(data.nameId);
  w.writeU4(data.startFrame);
  return w.toBuffer();
}

function decodeFrame(payload: Buffer): FrameTag {
  const r = new Reader(payload, 0);
  return { id: r.readU4(), numChildren: r.readU4() };
}

function encodeFrame(data: FrameTag): Buffer {
  const w = new Writer();
  w.writeU4(data.id);
  w.writeU4(data.numChildren);
  return w.toBuffer();
}

function decodePlaceObject(payload: Buffer): PlaceObjectTag {
  const r = new Reader(payload, 0);
  const characterId = r.readS4();
  const placementId = r.readS4();
  const unknown1 = r.readU4();
  const nameId = r.readU4();
  const placementMode = r.readU2();
  const blendMode = r.readU2();
  const depth = r.readU2();
  const unknown2 = r.readU2();
  const unknown3 = r.readU2();
  const unknown4 = r.readU2();
  const positionId = r.readS2();
  const positionFlags = r.readU2();
  const colorMultId = r.readS4();
  const colorAddId = r.readS4();
  const hasColorMatrix = r.readU4();
  const hasUnknownF014 = r.readU4();
  return {
    characterId,
    placementId,
    unknown1,
    nameId,
    placementMode,
    blendMode,
    depth,
    unknown2,
    unknown3,
    unknown4,
    positionId,
    positionFlags,
    colorMultId,
    colorAddId,
    hasColorMatrix,
    hasUnknownF014,
  };
}

function encodePlaceObject(data: PlaceObjectTag): Buffer {
  const w = new Writer();
  w.writeS4(data.characterId);
  w.writeS4(data.placementId);
  w.writeU4(data.unknown1);
  w.writeU4(data.nameId);
  w.writeU2(data.placementMode);
  w.writeU2(data.blendMode);
  w.writeU2(data.depth);
  w.writeU2(data.unknown2);
  w.writeU2(data.unknown3);
  w.writeU2(data.unknown4);
  w.writeS2(data.positionId);
  w.writeU2(data.positionFlags);
  w.writeS4(data.colorMultId);
  w.writeS4(data.colorAddId);
  w.writeU4(data.hasColorMatrix);
  w.writeU4(data.hasUnknownF014);
  return w.toBuffer();
}

function decodeRemoveObject(payload: Buffer): RemoveObjectTag {
  const r = new Reader(payload, 0);
  const unknown1 = r.readU4();
  const depth = r.readU2();
  const unknown2 = r.readU2();
  return { unknown1, depth, unknown2 };
}

function encodeRemoveObject(data: RemoveObjectTag): Buffer {
  const w = new Writer();
  w.writeU4(data.unknown1);
  w.writeU2(data.depth);
  w.writeU2(data.unknown2);
  return w.toBuffer();
}

function decodeDoAction(payload: Buffer): DoActionTag {
  const r = new Reader(payload, 0);
  return { actionId: r.readU4(), unknown: r.readU4() };
}

function encodeDoAction(data: DoActionTag): Buffer {
  const w = new Writer();
  w.writeU4(data.actionId);
  w.writeU4(data.unknown);
  return w.toBuffer();
}

function decodeDynamicText(payload: Buffer): DynamicTextTag {
  const r = new Reader(payload, 0);
  const characterId = r.readU4();
  const unknown1 = r.readU4();
  const placeholderText = r.readU4();
  const unknown2 = r.readU4();
  const strokeColorId = r.readU4();
  const unknown3Words = r.readU4Words(3);
  const alignment = r.readU2();
  const unknown4 = r.readU2();
  const unknown5Words = r.readU4Words(2);
  const size = r.readF4();
  const unknown6Words = r.readU4Words(4);
  return {
    characterId,
    unknown1,
    placeholderText,
    unknown2,
    strokeColorId,
    unknown3Words,
    alignment,
    unknown4,
    unknown5Words,
    size,
    unknown6Words,
  };
}

function encodeDynamicText(data: DynamicTextTag): Buffer {
  const w = new Writer();
  w.writeU4(data.characterId);
  w.writeU4(data.unknown1);
  w.writeU4(data.placeholderText);
  w.writeU4(data.unknown2);
  w.writeU4(data.strokeColorId);
  w.writeU4Words(data.unknown3Words);
  w.writeU2(data.alignment);
  w.writeU2(data.unknown4);
  w.writeU4Words(data.unknown5Words);
  w.writeF4(data.size);
  w.writeU4Words(data.unknown6Words);
  return w.toBuffer();
}

function decodeButton(payload: Buffer): ButtonTag {
  const r = new Reader(payload, 0);
  const characterId = r.readU4();
  // Kaitai: track_as_menu(b1) + unknown(b15) packed into one u2.
  const packedBits = r.readU2();
  const trackAsMenu = (packedBits & 1) !== 0;
  const unknownBits15 = (packedBits >>> 1) & 0x7fff;
  const actionOffset = r.readU2();
  const boundsId = r.readU4();
  const unknown2 = r.readU4();
  const numGraphics = r.readU4();
  return { characterId, trackAsMenu, unknownBits15, actionOffset, boundsId, unknown2, numGraphics };
}

function encodeButton(data: ButtonTag): Buffer {
  const w = new Writer();
  w.writeU4(data.characterId);
  const packedBits = ((data.unknownBits15 & 0x7fff) << 1) | (data.trackAsMenu ? 1 : 0);
  w.writeU2(packedBits);
  w.writeU2(data.actionOffset);
  w.writeU4(data.boundsId);
  w.writeU4(data.unknown2);
  w.writeU4(data.numGraphics);
  return w.toBuffer();
}

function decodeGraphic(payload: Buffer): GraphicTag {
  const r = new Reader(payload, 0);
  const atlasId = r.readU4();
  const fillType = r.readU2();
  const numVertices = r.readU2();
  const numIndices = r.readU4();
  const vertices: GraphicTag['vertices'] = [];
  for (let i = 0; i < numVertices; i++) {
    vertices.push({ x: r.readF4(), y: r.readF4(), u: r.readF4(), v: r.readF4() });
  }
  const indices: number[] = [];
  for (let i = 0; i < numIndices; i++) indices.push(r.readU2());
  return { atlasId, fillType, vertices, indices };
}

function encodeGraphic(data: GraphicTag): Buffer {
  const w = new Writer();
  w.writeU4(data.atlasId);
  w.writeU2(data.fillType);
  w.writeU2(data.vertices.length);
  w.writeU4(data.indices.length);
  for (const v of data.vertices) {
    w.writeF4(v.x);
    w.writeF4(v.y);
    w.writeF4(v.u);
    w.writeF4(v.v);
  }
  for (const idx of data.indices) w.writeU2(idx);
  return w.toBuffer();
}

function decodeActionScript(payload: Buffer): ActionScriptTag {
  const r = new Reader(payload, 0);
  const words: number[] = [];
  while (r.offset < payload.length) words.push(r.readU4());
  return { bytecodeWords: words };
}

function encodeActionScript(data: ActionScriptTag): Buffer {
  const w = new Writer();
  w.writeU4Words(data.bytecodeWords);
  return w.toBuffer();
}

function decodeFonts(payload: Buffer): FontsTag {
  const r = new Reader(payload, 0);
  return { unknown: r.readU4() };
}

function encodeFonts(data: FontsTag): Buffer {
  const w = new Writer();
  w.writeU4(data.unknown);
  return w.toBuffer();
}

function decodeUnknown(payload: Buffer): UnknownTag {
  const r = new Reader(payload, 0);
  const words: number[] = [];
  while (r.offset < payload.length) words.push(r.readU4());
  return { words };
}

function encodeUnknown(data: UnknownTag): Buffer {
  const w = new Writer();
  w.writeU4Words(data.words);
  return w.toBuffer();
}

function decodeTag(tagType: number, offset: number, payload: Buffer): { kind: LmbTagAst['kind']; data: any } {
  switch (tagType) {
    case TAG.SYMBOLS:
      return { kind: 'symbols', data: decodeSymbols(payload) };
    case TAG.COLORS:
      return { kind: 'colors', data: decodeColors(payload) };
    case TAG.TRANSFORMS:
      return { kind: 'transforms', data: decodeTransforms(payload) };
    case TAG.POSITIONS:
      return { kind: 'positions', data: decodePositions(payload) };
    case TAG.BOUNDS:
      return { kind: 'bounds', data: decodeBounds(payload) };
    case TAG.TEXTURE_ATLASES:
      return { kind: 'textureAtlases', data: decodeTextureAtlases(payload) };
    case TAG.PROPERTIES:
      return { kind: 'properties', data: decodeProperties(payload) };
    case TAG.DEFINES:
      return { kind: 'defines', data: decodeDefines(payload) };
    case TAG.DEFINE_SPRITE:
      return { kind: 'defineSprite', data: decodeDefineSprite(payload) };
    case TAG.FRAME_LABEL:
      return { kind: 'frameLabel', data: decodeFrameLabel(payload) };
    case TAG.KEYFRAME:
    case TAG.SHOW_FRAME:
      return { kind: 'frame', data: decodeFrame(payload) };
    case TAG.PLACE_OBJECT:
      return { kind: 'placeObject', data: decodePlaceObject(payload) };
    case TAG.REMOVE_OBJECT:
      return { kind: 'removeObject', data: decodeRemoveObject(payload) };
    case TAG.DO_ACTION:
      return { kind: 'doAction', data: decodeDoAction(payload) };
    case TAG.DYNAMIC_TEXT:
      return { kind: 'dynamicText', data: decodeDynamicText(payload) };
    case TAG.BUTTON:
      return { kind: 'button', data: decodeButton(payload) };
    case TAG.GRAPHIC:
      return { kind: 'graphic', data: decodeGraphic(payload) };
    case TAG.ACTION_SCRIPT:
    case TAG.ACTION_SCRIPT_2:
      return { kind: 'actionScript', data: decodeActionScript(payload) };
    case TAG.FONTS:
      return { kind: 'fonts', data: decodeFonts(payload) };
    default:
      return { kind: 'unknown', data: decodeUnknown(payload) };
  }
}

function payloadToWords(payload: Buffer): number[] {
  if (payload.length % 4 !== 0) throw new Error(`Payload not 4-byte aligned: ${payload.length}`);
  const out: number[] = [];
  for (let i = 0; i < payload.length; i += 4) out.push(payload.readUInt32LE(i));
  return out;
}

function decodeTagTree(r: Reader, endOffsetExclusive: number): LmbTagAst {
  const tagType = r.readU2();
  const offset = r.readU2();
  const dataLenUnits = r.readU4();
  const dataByteLength = dataLenUnits * 4;
  const payload = r.readBytes(dataByteLength);

  const { kind, data } = decodeTag(tagType, offset, payload);
  const words = payloadToWords(payload);

  const childrenCount = computeChildrenCount(tagType, payload);
  const children: LmbTagAst[] = [];
  for (let i = 0; i < childrenCount; i++) children.push(decodeTagTree(r, endOffsetExclusive));

  return { tagType, offset, words, kind, data, children } as LmbTagAst;
}

export function decodeLmbAst(buffer: Buffer): LmbAst {
  const r = new Reader(buffer, 0);
  const magic = r.readBytes(4).toString('ascii');
  if (magic !== 'LMB\u0000') throw new Error(`Invalid magic: ${JSON.stringify(magic)}`);

  const textureId = r.readU4();
  const resourceId = r.readU4();
  const xmdPaddingU32 = r.readU4();
  const numPadding = r.readU4();
  const unknown4 = r.readU4();
  const unknown5 = r.readU4();
  const totalFileLen = r.readU4();
  const paddingBytes = r.readBytes(numPadding * 0x10);
  const paddingWords: number[] = [];
  for (let i = 0; i < paddingBytes.length; i += 4) paddingWords.push(paddingBytes.readUInt32LE(i));

  const tagsStart = r.offset;
  const tagsEnd = totalFileLen;
  if (tagsEnd > buffer.length) throw new Error(`totalFileLen exceeds buffer length: ${tagsEnd} > ${buffer.length}`);
  r.offset = tagsStart;

  const tags: LmbTagAst[] = [];
  while (r.offset < tagsEnd) tags.push(decodeTagTree(r, tagsEnd));
  if (r.offset !== tagsEnd) throw new Error(`Tag parsing ended at ${r.offset}, expected ${tagsEnd}`);

  const trailing = buffer.subarray(tagsEnd);
  const trailingBytes: number[] = Array.from(trailing.values());

  return {
    header: { textureId, resourceId, xmdPaddingU32, numPadding, unknown4, unknown5, totalFileLen, paddingWords, trailingBytes },
    tags,
  };
}

function encodeTagTree(w: Writer, tag: LmbTagAst) {
  const dataLenUnits = tag.words.length;

  w.writeU2(tag.tagType);
  w.writeU2(tag.offset);
  w.writeU4(dataLenUnits);
  w.writeU4Words(tag.words);

  for (const c of tag.children) encodeTagTree(w, c);
}

export function encodeLmbAst(ast: LmbAst): Buffer {
  const w = new Writer();
  w.writeBytes(Buffer.from('LMB\u0000', 'ascii'));
  w.writeU4(ast.header.textureId);
  w.writeU4(ast.header.resourceId);
  w.writeU4(ast.header.xmdPaddingU32);
  w.writeU4(ast.header.numPadding);
  w.writeU4(ast.header.unknown4);
  w.writeU4(ast.header.unknown5);

  const totalLenOffset = w.size();
  w.writeU4(ast.header.totalFileLen >>> 0);

  const expectedPaddingWords = ast.header.numPadding * 4;
  if (ast.header.paddingWords.length !== expectedPaddingWords) {
    throw new Error(`paddingWords length mismatch: got=${ast.header.paddingWords.length}, expected=${expectedPaddingWords}`);
  }
  for (const pw of ast.header.paddingWords) w.writeU4(pw);

  for (const t of ast.tags) encodeTagTree(w, t);

  if (Array.isArray(ast.header.trailingBytes) && ast.header.trailingBytes.length > 0) {
    w.writeBytes(Buffer.from(ast.header.trailingBytes));
  }

  const out = w.toBuffer();
  // Keep totalFileLen as preserved value for round-trip stability.
  out.writeUInt32LE(ast.header.totalFileLen >>> 0, totalLenOffset);
  return out;
}

