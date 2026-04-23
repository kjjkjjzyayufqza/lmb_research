import type { Scene } from "./scene";
import type { ResourceStore } from "./store";
import type { NestedSpriteInstance } from "./types";

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

  gotoAndStopByLabel(path: string, label: string): boolean {
    const nested = this.resolvePath(path);
    if (!nested) { return false; }

    const targetFrame = nested.sprite.frameLabels[label];
    if (targetFrame === undefined) { return false; }

    this.rebuildToFrame(nested, targetFrame);
    nested.stopped = true;
    return true;
  }

  gotoAndStopByFrame(path: string, frame: number): boolean {
    const nested = this.resolvePath(path);
    if (!nested) return false;

    const targetFrame = frame - 1;
    const playable = nested.sprite.numFrames > 0
      ? nested.sprite.numFrames : nested.sprite.timeline.length;
    if (targetFrame < 0 || targetFrame >= playable) return false;

    this.rebuildToFrame(nested, targetFrame);
    nested.stopped = true;
    return true;
  }

  gotoAndPlayByLabel(path: string, label: string): boolean {
    const nested = this.resolvePath(path);
    if (!nested) return false;

    const targetFrame = nested.sprite.frameLabels[label];
    if (targetFrame === undefined) return false;

    this.rebuildToFrame(nested, targetFrame);
    nested.stopped = false;
    return true;
  }

  setNumberDisplay(basePath: string, value: number, digitPattern: string, digitCount: number): void {
    const digits = String(Math.abs(Math.floor(value))).padStart(digitCount, "0");
    for (let i = 0; i < digitCount && i < digits.length; i++) {
      const digitPath = `${basePath}/${digitPattern.replace("%d", String(i))}`;
      const digitValue = parseInt(digits[i], 10);
      this.gotoAndStopByLabel(digitPath, `Num${digitValue}`);
    }
  }

  listAllPaths(maxDepth = 6): string[] {
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

const COST_LABELS: Record<number, string> = {
  1500: "Cost1500",
  2000: "Cost2000",
  2500: "Cost2500",
  3000: "Cost3000",
};

export class MachineSelectController {
  private ctrl: LumenController;
  private data: MsData;
  private selectedIndex = 0;
  private pageOffset = 0;
  private readonly pageSize = 10;
  private log: (msg: string) => void;
  private pathCache: string[] = [];

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

  getPageOffset(): number {
    return this.pageOffset;
  }

  initialize(): void {
    this.pathCache = this.ctrl.listAllPaths();
    this.log(`Paths found: ${this.pathCache.length}`);

    this.ctrl.gotoAndPlayByLabel("Weapon_mc", "Start");
    this.ctrl.gotoAndStopByLabel("Select_mc", "Start");

    this.applySelection();
    this.applyPage();
  }

  selectByIndex(index: number): void {
    if (index < 0 || index >= this.data.characters.length) return;
    this.selectedIndex = index;

    const pageStart = this.pageOffset;
    const pageEnd = this.pageOffset + this.pageSize;
    if (index < pageStart || index >= pageEnd) {
      this.pageOffset = Math.floor(index / this.pageSize) * this.pageSize;
      this.applyPage();
    }

    this.applySelection();
  }

  selectNext(): void {
    this.selectByIndex((this.selectedIndex + 1) % this.data.characters.length);
  }

  selectPrev(): void {
    this.selectByIndex((this.selectedIndex - 1 + this.data.characters.length) % this.data.characters.length);
  }

  pageNext(): void {
    const newOffset = this.pageOffset + this.pageSize;
    if (newOffset < this.data.characters.length) {
      this.pageOffset = newOffset;
      this.selectedIndex = this.pageOffset;
      this.applyPage();
      this.applySelection();
    }
  }

  pagePrev(): void {
    const newOffset = this.pageOffset - this.pageSize;
    if (newOffset >= 0) {
      this.pageOffset = newOffset;
      this.selectedIndex = this.pageOffset;
      this.applyPage();
      this.applySelection();
    }
  }

  applySelection(): void {
    const ms = this.data.characters[this.selectedIndex];
    if (!ms) return;

    this.log(`[MS] ${ms.name} Cost=${ms.cost} HP=${ms.hp}`);

    const costLabel = COST_LABELS[ms.cost] ?? "Cost2000";
    this.ctrl.gotoAndStopByLabel("Cost_mc", costLabel);
    this.ctrl.gotoAndStopByLabel("CostNum_mc", costLabel);
    this.ctrl.gotoAndStopByLabel("CostNum_S_mc", costLabel);

    const masteryLevel = Math.min(5, Math.floor(this.selectedIndex / 10));
    const masteryLabel = masteryLevel > 0
      ? `Mastery${String(masteryLevel).padStart(2, "0")}`
      : "Non";
    this.ctrl.gotoAndStopByLabel("Mastery_mc", masteryLabel);
    this.ctrl.gotoAndStopByLabel("Mastery_S_mc", masteryLabel);

    this.ctrl.gotoAndStopByLabel("MachineNew_mc", "Non");
    this.ctrl.gotoAndStopByLabel("Charge_mc", "Charge");

    for (let i = 1; i <= 5; i++) {
      this.ctrl.gotoAndPlayByLabel(`Weapon_0${i}_mc`, "Start");
    }

    const inPageIndex = this.selectedIndex - this.pageOffset;
    for (let i = 1; i <= this.pageSize; i++) {
      const panelPath = `Panel${String(i).padStart(2, "0")}_mc`;
      if (i - 1 === inPageIndex) {
        this.ctrl.gotoAndStopByLabel(panelPath, "On");
      } else {
        this.ctrl.gotoAndStopByLabel(panelPath, "Off");
      }
    }
  }

  applyPage(): void {
    for (let i = 0; i < this.pageSize; i++) {
      const msIndex = this.pageOffset + i;
      const ms = this.data.characters[msIndex];
      const panelNum = String(i + 1).padStart(2, "0");

      if (ms) {
        const costLabel = COST_LABELS[ms.cost] ?? "Cost2000";
        this.ctrl.gotoAndStopByLabel(
          `MS_M_S_Dummy_mc`,
          `Dummy${panelNum}`
        );
      }
    }

    this.ctrl.gotoAndStopByLabel("SelectArrow_Up_mc", this.pageOffset > 0 ? "On" : "Non");
    this.ctrl.gotoAndStopByLabel("SelectArrow_Down_mc",
      this.pageOffset + this.pageSize < this.data.characters.length ? "On" : "Non");
  }

  triggerOpen(): void {
    this.ctrl.gotoAndPlayByLabel("Weapon_mc", "Open");
    this.ctrl.gotoAndPlayByLabel("Select_mc", "Start");
  }

  triggerSelect(): void {
    this.ctrl.gotoAndPlayByLabel("Select_mc", "Select");
  }
}
