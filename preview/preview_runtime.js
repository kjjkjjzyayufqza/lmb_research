export class ResourceStore {
    constructor(json) {
        this.spriteById = new Map();
        this.graphicByCharacterId = new Map();
        this.boundsById = new Map();
        this.buttonByCharacterId = new Map();
        this.json = json;
        for (const s of json.definitions.sprites) {
            this.spriteById.set(s.characterId, s);
        }
        for (const g of json.definitions.graphics) {
            if (g.characterId != null) {
                this.graphicByCharacterId.set(g.characterId, g);
            }
        }
        for (const btn of json.definitions.buttons) {
            this.buttonByCharacterId.set(btn.characterId, btn);
        }
        for (const b of json.resources.bounds) {
            this.boundsById.set(b.id, b);
        }
    }
    getMeta() {
        return this.json.meta;
    }
    getSprites() {
        return this.json.definitions.sprites;
    }
    getSpriteById(id) {
        return this.spriteById.get(id);
    }
    getGraphicForCharacter(characterId) {
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
    getBoundsById(id) {
        return this.boundsById.get(id);
    }
    getColorById(id) {
        if (id < 0) {
            return undefined;
        }
        return this.json.resources.colors[id];
    }
    getTransformFromPlaceObject(action) {
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
    constructor() {
        this.instances = new Map();
    }
    applyFrame(resourceStore, frame) {
        for (const rem of frame.removeList) {
            this.instances.delete(rem.depth);
        }
        for (const po of frame.displayList) {
            const transform = resourceStore.getTransformFromPlaceObject(po);
            const colorMult = resourceStore.getColorById(po.colorMultId);
            const colorAdd = resourceStore.getColorById(po.colorAddId);
            const graphic = resourceStore.getGraphicForCharacter(po.characterId);
            const instance = {
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
    getInstancesSorted() {
        return Array.from(this.instances.values()).sort((a, b) => a.depth - b.depth);
    }
}
export class TimelinePlayer {
    constructor(resourceStore, sprite, scene, onFrameChanged) {
        this.frameIndex = 0;
        this.playing = false;
        this.lastTime = 0;
        this.tick = (now) => {
            if (!this.playing) {
                return;
            }
            const delta = now - this.lastTime;
            if (delta >= this.frameDurationMs) {
                const framesToAdvance = Math.floor(delta / this.frameDurationMs);
                this.lastTime = now;
                this.frameIndex = (this.frameIndex + framesToAdvance) % Math.max(1, this.sprite.timeline.length);
                this.applyCurrentFrame();
            }
            requestAnimationFrame(this.tick);
        };
        this.resourceStore = resourceStore;
        this.sprite = sprite;
        this.scene = scene;
        this.frameDurationMs = 1000 / Math.max(1, resourceStore.getMeta().framerate || 30);
        this.onFrameChanged = onFrameChanged;
    }
    play() {
        if (this.playing)
            return;
        this.playing = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.tick);
    }
    pause() {
        this.playing = false;
    }
    stop() {
        this.playing = false;
        this.frameIndex = 0;
        this.applyCurrentFrame();
    }
    getCurrentFrameIndex() {
        return this.frameIndex;
    }
    getCurrentFrame() {
        return this.sprite.timeline[this.frameIndex];
    }
    applyCurrentFrame() {
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
