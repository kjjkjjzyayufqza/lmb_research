import { ResourceStore, Scene, TimelinePlayer, } from "./preview_runtime";
import { WebGlRenderer } from "./preview_renderer_webgl";
function $(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Element not found: ${id}`);
    }
    return el;
}
function appendLog(line) {
    const logView = $("logView");
    const now = new Date();
    const ts = now.toISOString().split("T")[1]?.replace("Z", "") ?? "";
    logView.textContent = `${logView.textContent || ""}[${ts}] ${line}\n`;
    logView.scrollTop = logView.scrollHeight;
}
async function loadJsonFromFile(file) {
    const text = await file.text();
    const json = JSON.parse(text);
    return json;
}
function populateMetaInfo(json) {
    const metaInfo = $("metaInfo");
    metaInfo.textContent = JSON.stringify(json.meta, null, 2);
}
function populateSpriteSelect(store, rootSpriteId) {
    const select = $("rootSpriteSelect");
    select.innerHTML = "";
    for (const sprite of store.getSprites()) {
        const option = document.createElement("option");
        const name = sprite.name ?? `Sprite_${sprite.characterId}`;
        option.value = String(sprite.characterId);
        option.textContent = `${sprite.characterId}: ${name}`;
        if (sprite.characterId === rootSpriteId) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}
function updateFrameInfo(frameIndex, frameLabel) {
    const frameIndexLabel = $("frameIndexLabel");
    const frameLabelLabel = $("frameLabelLabel");
    frameIndexLabel.textContent = String(frameIndex);
    frameLabelLabel.textContent = frameLabel ?? "-";
}
function updateFrameActionsInfo(frame) {
    const pre = $("frameActionsInfo");
    if (!frame) {
        pre.textContent = "";
        return;
    }
    const info = {
        frameIndex: frame.frameIndex,
        displayListCount: frame.displayList.length,
        removeCount: frame.removeList.length,
        actions: frame.actions,
    };
    pre.textContent = JSON.stringify(info, null, 2);
}
function findFrameLabelForIndex(sprite, frameIndex) {
    for (const [label, index] of Object.entries(sprite.frameLabels)) {
        if (index === frameIndex) {
            return label;
        }
    }
    return undefined;
}
function setupUi() {
    const jsonInput = $("jsonFileInput");
    const canvas = $("previewCanvas");
    const btnPlay = $("btnPlay");
    const btnPause = $("btnPause");
    const btnStop = $("btnStop");
    const rootSpriteSelect = $("rootSpriteSelect");
    let jsonData = null;
    let store = null;
    let renderer = null;
    let scene = null;
    let player = null;
    let currentSprite = null;
    function attachTimelineForSprite(spriteId) {
        if (!jsonData) {
            return;
        }
        if (!store) {
            store = new ResourceStore(jsonData);
        }
        const sprite = store.getSpriteById(spriteId);
        if (!sprite) {
            appendLog(`Sprite not found: ${spriteId}`);
            return;
        }
        currentSprite = sprite;
        if (!renderer) {
            renderer = new WebGlRenderer(canvas);
        }
        renderer.resizeForMeta(jsonData.meta);
        if (!scene) {
            scene = new Scene();
        }
        player = new TimelinePlayer(store, sprite, scene, (frame, sc) => {
            if (!renderer || !frame) {
                return;
            }
            const label = findFrameLabelForIndex(sprite, frame.frameIndex);
            updateFrameInfo(frame.frameIndex, label);
            updateFrameActionsInfo(frame);
            renderer.clear();
            renderer.renderScene(sc.getInstancesSorted());
        });
        if (sprite.timeline.length > 0 && scene) {
            scene.applyFrame(store, sprite.timeline[0]);
            if (renderer) {
                renderer.clear();
                renderer.renderScene(scene.getInstancesSorted());
            }
            updateFrameInfo(0, findFrameLabelForIndex(sprite, 0));
            updateFrameActionsInfo(sprite.timeline[0]);
        }
    }
    jsonInput.addEventListener("change", async () => {
        const file = jsonInput.files?.[0];
        if (!file) {
            return;
        }
        try {
            appendLog(`Loading JSON: ${file.name}`);
            const json = await loadJsonFromFile(file);
            jsonData = json;
            store = new ResourceStore(json);
            populateMetaInfo(json);
            populateSpriteSelect(store, json.timeline.rootSpriteId);
            if (!renderer) {
                renderer = new WebGlRenderer(canvas);
            }
            renderer.resizeForMeta(json.meta);
            try {
                await renderer.loadAtlasTextures(json, store);
                appendLog("Atlas textures loaded.");
            }
            catch (e) {
                appendLog(`Failed to load atlas textures: ${e.message}`);
            }
            const rootId = json.timeline.rootSpriteId;
            attachTimelineForSprite(rootId);
            appendLog(`Root sprite attached: ${rootId}`);
        }
        catch (e) {
            appendLog(`Failed to parse JSON: ${e.message}`);
        }
    });
    rootSpriteSelect.addEventListener("change", () => {
        if (!jsonData) {
            return;
        }
        const value = rootSpriteSelect.value;
        const spriteId = Number(value);
        if (Number.isNaN(spriteId)) {
            return;
        }
        appendLog(`Switching root sprite to ${spriteId}`);
        attachTimelineForSprite(spriteId);
    });
    btnPlay.addEventListener("click", () => {
        if (player) {
            player.play();
            appendLog("Play");
        }
    });
    btnPause.addEventListener("click", () => {
        if (player) {
            player.pause();
            appendLog("Pause");
        }
    });
    btnStop.addEventListener("click", () => {
        if (player) {
            player.stop();
            appendLog("Stop");
        }
    });
}
window.addEventListener("DOMContentLoaded", () => {
    setupUi();
});
