import {
  type LmbJson,
  type MetaDef,
  type SpriteDef,
  type GraphicDef,
  type TextDef,
  type BoundsDef,
  type ButtonDef,
  type ColorRgba,
  type TransformMatrix,
  type PlaceObjectAction,
  IDENTITY_TRANSFORM,
} from "./types";

/**
 * ResourceStore provides indexed access to all LMB JSON data.
 * It builds lookup maps on construction for O(1) access to sprites,
 * graphics, texts, buttons, and bounds by their IDs.
 */
export class ResourceStore {
  readonly json: LmbJson;

  private spriteById = new Map<number, SpriteDef>();
  private graphicByCharacterId = new Map<number, GraphicDef>();
  private textByCharacterId = new Map<number, TextDef>();
  private boundsById = new Map<number, BoundsDef>();
  private buttonByCharacterId = new Map<number, ButtonDef>();

  constructor(json: LmbJson) {
    this.json = json;
    this.rebuildIndexes();
  }

  /**
   * Rebuild all internal lookup maps from the current JSON data.
   * Call this after any mutation to definitions or resources.
   */
  rebuildIndexes(): void {
    this.spriteById.clear();
    this.graphicByCharacterId.clear();
    this.textByCharacterId.clear();
    this.boundsById.clear();
    this.buttonByCharacterId.clear();

    for (const s of this.json.definitions.sprites) {
      this.spriteById.set(s.characterId, s);
    }
    for (const g of this.json.definitions.graphics) {
      if (g.characterId != null) {
        this.graphicByCharacterId.set(g.characterId, g);
      }
    }
    for (const t of this.json.definitions.texts) {
      this.textByCharacterId.set(t.characterId, t);
    }
    for (const btn of this.json.definitions.buttons) {
      this.buttonByCharacterId.set(btn.characterId, btn);
    }
    for (const b of this.json.resources.bounds) {
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
    if (direct) return direct;
    const button = this.buttonByCharacterId.get(characterId);
    if (button && button.graphics && button.graphics.length > 0) {
      return button.graphics[0];
    }
    return undefined;
  }

  getTextForCharacter(characterId: number): TextDef | undefined {
    return this.textByCharacterId.get(characterId);
  }

  /**
   * Look up bounds by the bounds ID (not characterId).
   * Sprites carry a boundsId field that indexes into the bounds table.
   */
  getBoundsById(id: number): BoundsDef | undefined {
    return this.boundsById.get(id);
  }

  getColorById(id: number): ColorRgba | undefined {
    if (id < 0) return undefined;
    return this.json.resources.colors[id];
  }

  /**
   * Resolve the transform matrix for a PlaceObject action
   * based on its positionFlags and positionId.
   *
   * positionFlags semantics:
   *   0x0000 -> positionId indexes the transforms table
   *   0x8000 -> positionId indexes the positions table
   *   0xFFFF -> identity (no transform)
   */
  getTransformFromPlaceObject(action: PlaceObjectAction): TransformMatrix {
    const posId = action.positionId;
    const flags = action.positionFlags;

    if (posId < 0) return { ...IDENTITY_TRANSFORM };

    if (flags === 0x0000) {
      const t = this.json.resources.transforms[posId];
      return t ? t : { ...IDENTITY_TRANSFORM };
    }

    if (flags === 0x8000) {
      const pos = this.json.resources.positions[posId];
      return pos
        ? { a: 1, b: 0, c: 0, d: 1, x: pos.x, y: pos.y }
        : { ...IDENTITY_TRANSFORM };
    }

    if (flags === 0xffff) {
      return { ...IDENTITY_TRANSFORM };
    }

    // Fallback for unexpected flags: try transform, then position
    const t = this.json.resources.transforms[posId];
    if (t) return t;
    const pos = this.json.resources.positions[posId];
    if (pos) return { a: 1, b: 0, c: 0, d: 1, x: pos.x, y: pos.y };
    return { ...IDENTITY_TRANSFORM };
  }
}
