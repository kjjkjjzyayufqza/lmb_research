import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(import.meta.url);

// Ensure global environment for Kaitai UMD bundle (Lmb.js) under ESM/ts-node
const kaitaiModule = require('kaitai-struct');
const KaitaiStream = kaitaiModule.KaitaiStream;

const globalAny: any = globalThis as any;

// Some generated Kaitai bundles expect `self` to exist (browser-like env)
if (typeof globalAny.self === 'undefined') {
    globalAny.self = globalAny;
}

// Expose KaitaiStream globally so that Lmb.js can find it when using the
// browser/global fallback branch of its UMD wrapper.
if (!globalAny.KaitaiStream) {
    globalAny.KaitaiStream = KaitaiStream;
}

// Prepare namespace for Lmb.js to attach to when running in global mode.
if (!globalAny.Lmb) {
    globalAny.Lmb = {};
}

// Load generated Kaitai parser. Depending on the runtime, it either
// populates `module.exports.Lmb` (CommonJS-like) or `globalThis.Lmb.Lmb`
// (UMD-global branch).
const lmbModule = require('./Lmb');

const Lmb: any =
    (lmbModule && (lmbModule as any).Lmb)
        ? (lmbModule as any).Lmb
        : (globalAny.Lmb && (globalAny.Lmb as any).Lmb)
            ? (globalAny.Lmb as any).Lmb
            : undefined;

if (!Lmb) {
    throw new Error('Failed to load Lmb constructor from ./Lmb');
}

// --- Type Definitions ---

export interface LmbJson {
    meta: Meta;
    resources: Resources;
    definitions: Definitions;
    timeline: Timeline;
}

export interface Meta {
    magic: string;
    textureId: number;
    resourceId: number;
    totalFileLen: number;
    width: number;
    height: number;
    framerate: number;
    unknown: {
        xmdPadding?: any;
        numPadding: number;
        unknown4: number;
        unknown5: number;
        maxCharacterId?: number;
        entryCharacterId?: number;
        maxDepth?: number;
        unknownProperties?: any;
    };
}

export interface Resources {
    symbols: SymbolItem[];
    colors: ColorItem[];
    transforms: TransformItem[];
    positions: PositionItem[];
    bounds: BoundsItem[];
    textureAtlases: TextureAtlasItem[];
}

export interface SymbolItem {
    id: number;
    value: string;
}

export interface ColorItem {
    id: number;
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface TransformItem {
    id: number;
    a: number;
    b: number;
    c: number;
    d: number;
    x: number;
    y: number;
}

export interface PositionItem {
    id: number;
    x: number;
    y: number;
}

export interface BoundsItem {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TextureAtlasItem {
    id: number;
    nameSymbolId: number;
    name?: string; // Resolved name from symbols
    width: number;
    height: number;
}

export interface Definitions {
    sprites: SpriteDef[];
    texts: TextDef[];
    buttons: ButtonDef[];
    graphics: GraphicDef[];
    unknowns: any[];
}

export interface SpriteDef {
    characterId: number;
    nameSymbolId: number;
    name?: string; // Resolved name
    boundsId: number;
    numFrames: number;
    numKeyframes: number;
    numFrameLabels: number;
    frameLabels: { [label: string]: number };
    timeline: Frame[];
}

export interface Frame {
    frameIndex: number; // logical index
    isKeyframe: boolean;
    label?: string;
    displayList: PlaceObjectAction[];
    actions: DoAction[];
    removeList: RemoveObjectAction[];
}

export interface PlaceObjectAction {
    type: 'placeObject';
    characterId: number;
    placementId: number;
    depth: number;
    nameId: number;
    placementMode: string; // Enum string
    blendMode: string; // Enum string
    positionId: number; // -1 if none
    positionFlags: number;
    colorMultId: number;
    colorAddId: number;
    hasColorMatrix: boolean;
    hasUnknownF014: boolean;
    // Resolved references
    transform?: TransformItem | PositionItem;
    colorMult?: ColorItem;
    colorAdd?: ColorItem;
}

export interface RemoveObjectAction {
    type: 'removeObject';
    depth: number;
}

export interface DoAction {
    type: 'doAction';
    actionId: number;
}

export interface TextDef {
    characterId: number;
    placeholderTextId: number;
    placeholderText?: string;
    strokeColorId: number;
    strokeColor?: ColorItem;
    alignment: number; // Enum
    size: number;
    // Add more fields as discovered
}

export interface ButtonDef {
    characterId: number;
    trackAsMenu: boolean;
    boundsId: number;
    actionOffset: number;
    graphics: any[]; // To be detailed
}

export interface GraphicDef {
    // To be detailed based on Graphic tag
    atlasId: number;
    fillType: number;
    vertices: { x: number, y: number, u: number, v: number }[];
    indices: number[];
}

export interface Timeline {
    rootSpriteId: number;
    // The root timeline might be the timeline of the entry sprite
}

// --- Conversion Logic ---

function lmbToJson(lmb: any): LmbJson {
    const root = lmb.lmb;

    // 1. Meta
    const meta: Meta = {
        magic: new TextDecoder().decode(root.magic).replace(/\0/g, ''),
        textureId: root.textureId,
        resourceId: root.resourceId,
        totalFileLen: root.totalFileLen,
        width: 0,
        height: 0,
        framerate: 0,
        unknown: {
            numPadding: root.numPadding,
            unknown4: root.unknown4,
            unknown5: root.unknown5,
        }
    };

    // Initialize containers
    const resources: Resources = {
        symbols: [],
        colors: [],
        transforms: [],
        positions: [],
        bounds: [],
        textureAtlases: []
    };

    const definitions: Definitions = {
        sprites: [],
        texts: [],
        buttons: [],
        graphics: [],
        unknowns: []
    };

    let entryCharacterId = -1;

    // 2. Iterate Tags
    // Lmb.js tags are in root.tags
    // We need to iterate and switch based on tagType
    
    // Helper to get enum name
    const getEnumName = (enumObj: any, val: number) => enumObj[val] || 'UNKNOWN';

    for (const tag of root.tags) {
        const type = tag.tagType;
        const data = tag.data;

        switch (type) {
            case Lmb.Tag.FlashTagType.SYMBOLS: // 0xF001
                if (data.values) {
                    data.values.forEach((s: any, idx: number) => {
                        resources.symbols.push({
                            id: idx, // Implicit ID based on index
                            value: s.value
                        });
                    });
                }
                break;

            case Lmb.Tag.FlashTagType.COLORS: // 0xF002
                if (data.values) {
                    data.values.forEach((c: any, idx: number) => {
                        resources.colors.push({
                            id: idx,
                            r: c.r,
                            g: c.g,
                            b: c.b,
                            a: c.a
                        });
                    });
                }
                break;

            case Lmb.Tag.FlashTagType.TRANSFORMS: // 0xF003
                if (data.values) {
                    data.values.forEach((m: any, idx: number) => {
                        resources.transforms.push({
                            id: idx,
                            a: m.a, b: m.b, c: m.c, d: m.d, x: m.x, y: m.y
                        });
                    });
                }
                break;

            case Lmb.Tag.FlashTagType.POSITIONS: // 0xF103
                if (data.values) {
                    data.values.forEach((p: any, idx: number) => {
                        resources.positions.push({
                            id: idx,
                            x: p.x, y: p.y
                        });
                    });
                }
                break;

            case Lmb.Tag.FlashTagType.BOUNDS: // 0xF004
                if (data.values) {
                    data.values.forEach((b: any, idx: number) => {
                        resources.bounds.push({
                            id: idx,
                            x: b.x, y: b.y, width: b.width, height: b.height
                        });
                    });
                }
                break;

            case Lmb.Tag.FlashTagType.TEXTURE_ATLASES: // 0xF007
                if (data.values) {
                    data.values.forEach((t: any) => {
                        resources.textureAtlases.push({
                            id: t.id,
                            nameSymbolId: t.nameId,
                            width: t.width,
                            height: t.height
                        });
                    });
                }
                break;

            case Lmb.Tag.FlashTagType.PROPERTIES: // 0xF00C
                meta.width = data.width;
                meta.height = data.height;
                meta.framerate = data.framerate;
                meta.unknown.maxCharacterId = data.maxCharacterId;
                meta.unknown.entryCharacterId = data.entryCharacterId;
                meta.unknown.maxDepth = data.maxDepth;
                meta.unknown.unknownProperties = {
                    unknown2: data.unknown2,
                    unknown3: data.unknown3
                };
                entryCharacterId = data.entryCharacterId;
                break;

            case Lmb.Tag.FlashTagType.DEFINES: // 0xF00D
                // This tag mainly holds counts, but its children contain the actual definitions
                processDefinesChildren(tag.children, definitions, resources);
                break;
            
            // Some definitions might be at root level? Unlikely based on ksy but handle if needed
            // Or if DEFINES is just a wrapper
        }
    }

    // Resolve names for convenience
    resources.textureAtlases.forEach(atlas => {
        const sym = resources.symbols[atlas.nameSymbolId];
        if (sym) atlas.name = sym.value;
    });

    definitions.sprites.forEach(sprite => {
        const sym = resources.symbols[sprite.nameSymbolId];
        if (sym) sprite.name = sym.value;
    });

    const timeline: Timeline = {
        rootSpriteId: entryCharacterId
    };

    return {
        meta,
        resources,
        definitions,
        timeline
    };
}

function processDefinesChildren(children: any[], definitions: Definitions, resources: Resources) {
    if (!children) return;

    for (const child of children) {
        const type = child.tagType;
        const data = child.data;

        switch (type) {
            case Lmb.Tag.FlashTagType.DEFINE_SPRITE: // 0x0027
                const sprite: SpriteDef = {
                    characterId: data.characterId,
                    nameSymbolId: data.nameId,
                    boundsId: data.boundsId,
                    numFrames: data.numFrames,
                    numKeyframes: data.numKeyframes,
                    numFrameLabels: data.numFrameLabels,
                    frameLabels: {},
                    timeline: []
                };
                
                // Process sprite children to build timeline
                processSpriteTimeline(child.children, sprite);
                definitions.sprites.push(sprite);
                break;

            case Lmb.Tag.FlashTagType.BUTTON: // 0xF022
                 const btn: ButtonDef = {
                    characterId: data.characterId,
                    trackAsMenu: data.trackAsMenu,
                    boundsId: data.boundsId,
                    actionOffset: data.actionOffset,
                    graphics: [] 
                 };
                 
                 if (child.children) {
                     for (const subChild of child.children) {
                         if (subChild.tagType === Lmb.Tag.FlashTagType.GRAPHIC) {
                             btn.graphics.push(processGraphic(subChild.data));
                         }
                     }
                 }

                 definitions.buttons.push(btn);
                 break;

            case Lmb.Tag.FlashTagType.DYNAMIC_TEXT: // 0x0025
                const txt: TextDef = {
                    characterId: data.characterId,
                    placeholderTextId: data.placeholderText,
                    strokeColorId: data.strokeColorId,
                    alignment: data.alignment,
                    size: data.size
                };
                // Resolve simple refs
                const txtSym = resources.symbols[txt.placeholderTextId];
                if (txtSym) txt.placeholderText = txtSym.value;
                const col = resources.colors[txt.strokeColorId];
                if (col) txt.strokeColor = col;
                
                definitions.texts.push(txt);
                break;

            case Lmb.Tag.FlashTagType.GRAPHIC: // 0xF024
                definitions.graphics.push(processGraphic(data));
                break;

            default:
                // console.warn(`Unknown definition child type: ${type}`);
                definitions.unknowns.push({ type, data });
        }
    }
}

function processGraphic(data: any): GraphicDef {
    const graphic: GraphicDef = {
        atlasId: data.atlasId,
        fillType: data.fillType,
        vertices: [],
        indices: []
    };
    if (data.vertices) {
        data.vertices.forEach((v: any) => {
            graphic.vertices.push({ x: v.x, y: v.y, u: v.u, v: v.v });
        });
    }
    if (data.indices) {
        graphic.indices = Array.from(data.indices);
    }
    return graphic;
}

function processSpriteTimeline(children: any[], sprite: SpriteDef) {
    if (!children) return;

    let currentFrame: Frame | null = null;
    let frameIndex = 0;

    for (const child of children) {
        const type = child.tagType;
        const data = child.data;

        // frame_label often comes before the frame it labels, or is part of the keyframe
        // Based on KSY, frame_label is a tag. 
        
        if (type === Lmb.Tag.FlashTagType.FRAME_LABEL) {
            const nameId = data.nameId;
            // We don't have symbols access here easily unless passed down, 
            // or we just store ID and resolve later. Let's store ID for now or try to grab if possible.
            // Actually, let's just store the label mapping by frame index
            // The KSY says: `start_frame` is a field in frame_label
            // But usually frame labels are associated with the *next* frame or specific frame index.
            // Lmb.ksy: frame_label -> name_id, start_frame
            // So it explicitly says which frame it starts at.
            // We can add it to sprite.frameLabels map.
            // We need the label string, but we don't have symbols here. 
            // We'll store the nameId in the map keys for now as string "ID:<id>" or handle name resolution later?
            // Better: let's pass resources or just store raw for now and fix up later.
            // Actually, let's store it as `frameLabels: { [frameIndex]: nameId }` temporarily? 
            // The interface says `[label: string]: number`.
            // We'll assume we can resolve it later or just store raw ID if needed.
            // Wait, looking at `processDefinesChildren`, I didn't pass `resources` to `processSpriteTimeline`.
            // Let's fix that in next edit. For now, let's just record what we can.
            
            // Actually, frame_label in KSY has `start_frame`. 
            // So `sprite.frameLabels["ID_" + nameId] = start_frame`. 
            sprite.frameLabels[`Symbol_${nameId}`] = data.startFrame;
            continue;
        }

        // Frame / Keyframe
        if (type === Lmb.Tag.FlashTagType.KEYFRAME || type === Lmb.Tag.FlashTagType.SHOW_FRAME) {
            // Finalize previous frame if needed? 
            // No, in this structure, a tag represents a frame.
            // Wait, KSY says "children directly follow this tag, they may be place/remove object or do_action"
            // So this tag IS the frame container.
            
            const isKeyframe = (type === Lmb.Tag.FlashTagType.KEYFRAME);
            
            currentFrame = {
                frameIndex: frameIndex, // Sequential index
                isKeyframe: isKeyframe,
                displayList: [],
                actions: [],
                removeList: []
            };

            // Process children of the frame (actions, placements)
            if (child.children) {
                for (const op of child.children) {
                    const opType = op.tagType;
                    const opData = op.data;

                    if (opType === Lmb.Tag.FlashTagType.PLACE_OBJECT) {
                        const po: PlaceObjectAction = {
                            type: 'placeObject',
                            characterId: opData.characterId,
                            placementId: opData.placementId,
                            depth: opData.depth,
                            nameId: opData.nameId,
                            placementMode: Lmb.PlacementMode[opData.placementMode] || 'UNKNOWN',
                            blendMode: Lmb.BlendMode[opData.blendMode] || 'UNKNOWN',
                            positionId: opData.positionId,
                            positionFlags: opData.positionFlags,
                            colorMultId: opData.colorMultId,
                            colorAddId: opData.colorAddId,
                            hasColorMatrix: !!opData.hasColorMatrix,
                            hasUnknownF014: !!opData.hasUnknownF014
                        };
                        currentFrame.displayList.push(po);
                    } else if (opType === Lmb.Tag.FlashTagType.REMOVE_OBJECT) {
                        currentFrame.removeList.push({
                            type: 'removeObject',
                            depth: opData.depth
                        });
                    } else if (opType === Lmb.Tag.FlashTagType.DO_ACTION) {
                        currentFrame.actions.push({
                            type: 'doAction',
                            actionId: opData.actionId
                        });
                    }
                }
            }

            sprite.timeline.push(currentFrame);
            frameIndex++;
        }
    }
}

// --- Main Runner ---

// Use CLI argument if provided, e.g. `bun lmbtojson.ts input.lmb`.
// Fall back to the sample file name for compatibility.
const argv = (globalAny.Bun && Array.isArray(globalAny.Bun.argv))
    ? globalAny.Bun.argv.slice(2)
    : (typeof process !== 'undefined' && Array.isArray((process as any).argv)
        ? (process as any).argv.slice(2)
        : []);

const inputPath = argv[0];
const resolvedInputPath = path.resolve(inputPath);
const outputPath = path.join(
    path.dirname(resolvedInputPath),
    `${path.basename(resolvedInputPath, path.extname(resolvedInputPath) || '.lmb')}.json`,
);

if (fs.existsSync(resolvedInputPath)) {
    console.log(`Reading ${resolvedInputPath}...`);
    const buffer = fs.readFileSync(resolvedInputPath);
    const lmb = new Lmb(new KaitaiStream(buffer));

    console.log('Converting to JSON...');
    try {
        const json = lmbToJson(lmb);

        // Post-process to resolve frame labels if possible
        json.definitions.sprites.forEach(spr => {
            const newLabels: { [label: string]: number } = {};
            for (const [key, frameIdx] of Object.entries(spr.frameLabels)) {
                if (key.startsWith('Symbol_')) {
                    const symId = parseInt(key.split('_')[1]);
                    const sym = json.resources.symbols[symId];
                    if (sym) {
                        newLabels[sym.value] = frameIdx;
                    } else {
                        newLabels[key] = frameIdx;
                    }
                } else {
                    newLabels[key] = frameIdx;
                }
            }
            spr.frameLabels = newLabels;
        });

        fs.writeFileSync(
            outputPath,
            JSON.stringify(
                json,
                (_key, value) => value,
                2,
            ),
        );

        console.log(`Success! Output written to ${outputPath}`);
        console.log(`Stats:`);
        console.log(`- Sprites: ${json.definitions.sprites.length}`);
        console.log(`- Symbols: ${json.resources.symbols.length}`);
        console.log(`- Textures: ${json.resources.textureAtlases.length}`);
        console.log(`- FrameRate: ${json.meta.framerate}`);
    } catch (e) {
        console.error('Conversion failed:', e);
    }
} else {
    console.error(`Input file not found: ${resolvedInputPath}`);
}

