import type { Scene } from "./scene";
import type { ResourceStore } from "./store";
import type { NestedSpriteInstance } from "./types";

/**
 * LumenController simulates the C++ COutHud* classes that drive
 * Lumen UI via path-based MovieClip resolution.
 *
 * The game engine uses three core operations:
 *   1. gotoAndStopByLabel(path, label) — resolve MC by path, jump to label
 *   2. gotoAndStopByFrame(path, frame) — resolve MC by path, jump to frame number
 *   3. replaceText(path, text) — replace dynamic text field content
 *
 * Paths use Flash-style `/root_mc/child_mc` notation, resolved against the
 * Scene's nested sprite tree via instance names.
 */
export class LumenController {
  private scene: Scene;
  private resourceStore: ResourceStore;
  private log: (msg: string) => void;

  constructor(scene: Scene, resourceStore: ResourceStore, log?: (msg: string) => void) {
    this.scene = scene;
    this.resourceStore = resourceStore;
    this.log = log ?? (() => {});
  }

  updateScene(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Resolve a MovieClip by slash-separated path.
   * e.g. "/ControlPanel_mc/ViewMode_mc" → finds nested sprite named "ViewMode_mc"
   * inside the sprite named "ControlPanel_mc".
   */
  resolvePath(path: string): NestedSpriteInstance | undefined {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return undefined;

    let current: NestedSpriteInstance | undefined;

    for (const part of parts) {
      if (!current) {
        current = this.scene.getNestedByName(part);
        if (!current) {
          for (const nested of this.scene.getNestedSpriteInstances()) {
            const found = nested.scene.getNestedByName(part);
            if (found) { current = found; break; }
            const deep = this.deepFindByName(nested, part);
            if (deep) { current = deep; break; }
          }
        }
      } else {
        const child = current.scene.getNestedByName(part);
        if (child) {
          current = child;
        } else {
          const deep = this.deepFindByName(current, part);
          if (deep) { current = deep; } else { return undefined; }
        }
      }
      if (!current) return undefined;
    }

    return current;
  }

  private deepFindByName(root: NestedSpriteInstance, name: string): NestedSpriteInstance | undefined {
    for (const child of root.scene.getNestedSpriteInstances()) {
      if (child.name === name) return child;
      const found = this.deepFindByName(child, name);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Navigate a MovieClip to a labeled frame (like C++ LumenGotoAndStopByLabel).
   */
  gotoAndStopByLabel(path: string, label: string): boolean {
    const nested = this.resolvePath(path);
    if (!nested) {
      this.log(`gotoAndStopByLabel: path "${path}" not found`);
      return false;
    }

    const targetFrame = nested.sprite.frameLabels[label];
    if (targetFrame === undefined) {
      this.log(`gotoAndStopByLabel: label "${label}" not found in ${path}`);
      return false;
    }

    this.rebuildToFrame(nested, targetFrame);
    nested.stopped = true;
    this.log(`${path} → gotoAndStop("${label}") [frame ${targetFrame}]`);
    return true;
  }

  /**
   * Navigate a MovieClip to a frame number (like C++ LumenGotoAndStopByFrame).
   * Frame numbers are 1-based (Flash convention).
   */
  gotoAndStopByFrame(path: string, frame: number): boolean {
    const nested = this.resolvePath(path);
    if (!nested) {
      this.log(`gotoAndStopByFrame: path "${path}" not found`);
      return false;
    }

    const targetFrame = frame - 1;
    const playable = nested.sprite.numFrames > 0
      ? nested.sprite.numFrames : nested.sprite.timeline.length;
    if (targetFrame < 0 || targetFrame >= playable) {
      this.log(`gotoAndStopByFrame: frame ${frame} out of range for ${path} (0-${playable - 1})`);
      return false;
    }

    this.rebuildToFrame(nested, targetFrame);
    nested.stopped = true;
    this.log(`${path} → gotoAndStop(${frame}) [frame ${targetFrame}]`);
    return true;
  }

  /**
   * Navigate and play from a label.
   */
  gotoAndPlayByLabel(path: string, label: string): boolean {
    const nested = this.resolvePath(path);
    if (!nested) return false;

    const targetFrame = nested.sprite.frameLabels[label];
    if (targetFrame === undefined) return false;

    this.rebuildToFrame(nested, targetFrame);
    nested.stopped = false;
    this.log(`${path} → gotoAndPlay("${label}") [frame ${targetFrame}]`);
    return true;
  }

  /**
   * Set a number display by splitting digits and calling gotoAndStop on each digit MC.
   * Used for Cost, HP, scores etc.
   *
   * @param basePath  Path to the number container MC
   * @param value     The number to display
   * @param digitPattern  Format string for digit MCs, e.g. "NumTag%d_mc"
   * @param digitCount  Number of digits to display
   */
  setNumberDisplay(basePath: string, value: number, digitPattern: string, digitCount: number): void {
    const digits = String(Math.abs(Math.floor(value))).padStart(digitCount, "0");
    for (let i = 0; i < digitCount && i < digits.length; i++) {
      const digitPath = `${basePath}/${digitPattern.replace("%d", String(i))}`;
      const digitValue = parseInt(digits[i], 10);
      this.gotoAndStopByLabel(digitPath, `Num${digitValue}`);
    }
  }

  /**
   * Convenience: set Cost display by choosing the right Cost label.
   */
  setCostLabel(path: string, cost: number): boolean {
    const label = `Cost${cost}`;
    return this.gotoAndStopByLabel(path, label);
  }

  /**
   * Convenience: set Mastery display.
   */
  setMasteryLabel(path: string, level: number): boolean {
    const label = level <= 0 ? "Non" : `Mastery${String(level).padStart(2, "0")}`;
    return this.gotoAndStopByLabel(path, label);
  }

  /**
   * List all reachable nested sprite names from the scene root.
   * Useful for debugging path resolution.
   */
  listAllPaths(maxDepth = 5): string[] {
    const paths: string[] = [];
    const walk = (prefix: string, scene: Scene, depth: number) => {
      if (depth > maxDepth) return;
      for (const nested of scene.getNestedSpriteInstances()) {
        const name = nested.name ?? `placement_${nested.placementId}`;
        const full = prefix ? `${prefix}/${name}` : name;
        paths.push(full);
        walk(full, nested.scene, depth + 1);
      }
    };
    walk("", this.scene, 0);
    return paths;
  }

  private rebuildToFrame(nested: NestedSpriteInstance, target: number): void {
    const playable = nested.sprite.numFrames > 0
      ? nested.sprite.numFrames : nested.sprite.timeline.length;
    const clamped = Math.max(0, Math.min(target, playable - 1));
    nested.scene.reset();
    for (let fi = 0; fi <= clamped; fi++) {
      if (fi > 0) nested.scene.advanceNestedSprites(this.resourceStore, 1);
      nested.scene.applyFrame(this.resourceStore, nested.sprite.timeline[fi]);
    }
    nested.frameIndex = clamped;
  }
}

/**
 * MS (Mobile Suit) data loaded from ms_data.json.
 */
export interface MsEntry {
  id: number;
  name: string;
  cost: number;
  hp: number;
  series: string;
  icon: number;
  unique: number;
  state: number;
}

export interface MsData {
  characters: MsEntry[];
  masteryLevels: { level: number; points: number }[];
  awakeningTypes: { id: number; index: number }[];
  costTiers: number[];
}

/**
 * MachineSelectController drives the machineselect.lm UI
 * with real game data, simulating COutHudMachineSelect.
 */
export class MachineSelectController {
  private ctrl: LumenController;
  private data: MsData;
  private selectedIndex = 0;
  private log: (msg: string) => void;

  constructor(ctrl: LumenController, data: MsData, log?: (msg: string) => void) {
    this.ctrl = ctrl;
    this.data = data;
    this.log = log ?? (() => {});
  }

  getSelectedMs(): MsEntry | undefined {
    return this.data.characters[this.selectedIndex];
  }

  getCharacters(): MsEntry[] {
    return this.data.characters;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /**
   * Select a machine by index and update the UI.
   */
  selectByIndex(index: number): void {
    if (index < 0 || index >= this.data.characters.length) return;
    this.selectedIndex = index;
    this.applySelection();
  }

  selectNext(): void {
    this.selectByIndex((this.selectedIndex + 1) % this.data.characters.length);
  }

  selectPrev(): void {
    this.selectByIndex((this.selectedIndex - 1 + this.data.characters.length) % this.data.characters.length);
  }

  /**
   * Apply the current selection to the Lumen sprite tree.
   * This replicates what COutHudMachineSelect does each frame.
   */
  applySelection(): void {
    const ms = this.data.characters[this.selectedIndex];
    if (!ms) return;

    this.log(`Select MS: ${ms.name} (Cost=${ms.cost}, HP=${ms.hp})`);

    const allPaths = this.ctrl.listAllPaths();
    this.log(`Available paths (${allPaths.length}): ${allPaths.slice(0, 20).join(", ")}...`);
  }

  /**
   * Trigger the "Open" animation on the main panel.
   */
  triggerOpen(): void {
    this.ctrl.gotoAndPlayByLabel("ControlPanel_mc", "Start");
  }

  /**
   * Trigger selection confirmation.
   */
  triggerSelect(): void {
    const allPaths = this.ctrl.listAllPaths();
    for (const p of allPaths) {
      if (p.includes("Select") || p.includes("select")) {
        this.log(`Found select-related path: ${p}`);
      }
    }
  }
}
