import {
  LmbJson,
  ResourceStore,
  Scene,
  SpriteDef,
  TimelinePlayer,
} from "./preview_runtime";
import { WebGlRenderer } from "./preview_renderer_webgl";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element not found: ${id}`);
  }
  return el;
}

function appendLog(line: string): void {
  const logView = $("logView") as HTMLPreElement;
  const now = new Date();
  const ts = now.toISOString().split("T")[1]?.replace("Z", "") ?? "";
  logView.textContent = `${logView.textContent || ""}[${ts}] ${line}\n`;
  logView.scrollTop = logView.scrollHeight;
}

async function loadJsonFromFile(file: File): Promise<LmbJson> {
  const text = await file.text();
  const json = JSON.parse(text);
  return json as LmbJson;
}

function populateMetaInfo(json: LmbJson): void {
  const metaInfo = $("metaInfo") as HTMLPreElement;
  metaInfo.textContent = JSON.stringify(json.meta, null, 2);
}

function populateSpriteSelect(store: ResourceStore, rootSpriteId: number): void {
  const select = $("rootSpriteSelect") as HTMLSelectElement;
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

function updateFrameInfo(frameIndex: number, frameLabel: string | undefined): void {
  const frameIndexLabel = $("frameIndexLabel");
  const frameLabelLabel = $("frameLabelLabel");
  frameIndexLabel.textContent = String(frameIndex);
  frameLabelLabel.textContent = frameLabel ?? "-";
}

function updateFrameActionsInfo(frame: SpriteDef["timeline"][number] | undefined): void {
  const pre = $("frameActionsInfo") as HTMLPreElement;
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

function findFrameLabelForIndex(sprite: SpriteDef, frameIndex: number): string | undefined {
  for (const [label, index] of Object.entries(sprite.frameLabels)) {
    if (index === frameIndex) {
      return label;
    }
  }
  return undefined;
}

function setupUi(): void {
  const jsonInput = $("jsonFileInput") as HTMLInputElement;
  const canvas = $("previewCanvas") as HTMLCanvasElement;
  const btnPlay = $("btnPlay") as HTMLButtonElement;
  const btnPause = $("btnPause") as HTMLButtonElement;
  const btnStop = $("btnStop") as HTMLButtonElement;
  const rootSpriteSelect = $("rootSpriteSelect") as HTMLSelectElement;

  let jsonData: LmbJson | null = null;
  let store: ResourceStore | null = null;
  let renderer: WebGlRenderer | null = null;
  let scene: Scene | null = null;
  let player: TimelinePlayer | null = null;
  let currentSprite: SpriteDef | null = null;

  function attachTimelineForSprite(spriteId: number): void {
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
      } catch (e) {
        appendLog(`Failed to load atlas textures: ${(e as Error).message}`);
      }

      const rootId = json.timeline.rootSpriteId;
      attachTimelineForSprite(rootId);
      appendLog(`Root sprite attached: ${rootId}`);
    } catch (e) {
      appendLog(`Failed to parse JSON: ${(e as Error).message}`);
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


