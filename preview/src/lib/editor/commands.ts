import type {
  LmbJson,
  ColorRgba,
  TransformMatrix,
  Vec2,
  BoundsDef,
  PlaceObjectAction,
  RemoveObjectAction,
  DoAction,
} from "../lmb/types";
import {
  validateColor,
  validateTransform,
  validatePosition,
  validateBounds,
  validatePlaceObject,
} from "./validate";

// ============================================================
// Command types
// ============================================================

export type EditorCommand =
  | { type: "UPDATE_COLOR"; index: number; patch: Partial<ColorRgba> }
  | { type: "UPDATE_TRANSFORM"; index: number; patch: Partial<TransformMatrix> }
  | { type: "UPDATE_POSITION"; index: number; patch: Partial<Vec2> }
  | { type: "UPDATE_BOUNDS"; index: number; patch: Partial<BoundsDef> }
  | {
      type: "UPDATE_PLACE_OBJECT";
      spriteCharacterId: number;
      frameIndex: number;
      placeIndex: number;
      patch: Partial<PlaceObjectAction>;
    }
  | {
      type: "INSERT_PLACE_OBJECT";
      spriteCharacterId: number;
      frameIndex: number;
      placeObject: PlaceObjectAction;
    }
  | {
      type: "DELETE_PLACE_OBJECT";
      spriteCharacterId: number;
      frameIndex: number;
      placeIndex: number;
    }
  | {
      type: "INSERT_REMOVE_OBJECT";
      spriteCharacterId: number;
      frameIndex: number;
      removeObject: RemoveObjectAction;
    }
  | {
      type: "DELETE_REMOVE_OBJECT";
      spriteCharacterId: number;
      frameIndex: number;
      removeIndex: number;
    }
  | {
      type: "INSERT_ACTION";
      spriteCharacterId: number;
      frameIndex: number;
      action: DoAction;
    }
  | {
      type: "DELETE_ACTION";
      spriteCharacterId: number;
      frameIndex: number;
      actionIndex: number;
    };

// ============================================================
// Undo entry: stores the inverse information needed to undo
// ============================================================

export interface UndoEntry {
  description: string;
  command: EditorCommand;
  inverseCommand: EditorCommand;
}

// ============================================================
// Command execution
// ============================================================

function findSpriteAndFrame(
  json: LmbJson,
  spriteCharacterId: number,
  frameIndex: number
) {
  const sprite = json.definitions.sprites.find(
    (s) => s.characterId === spriteCharacterId
  );
  if (!sprite) throw new Error(`Sprite ${spriteCharacterId} not found`);
  const frame = sprite.timeline[frameIndex];
  if (!frame) throw new Error(`Frame ${frameIndex} not found in sprite ${spriteCharacterId}`);
  return { sprite, frame };
}

/**
 * Execute a command on the JSON data, returning an UndoEntry
 * that can be used to reverse the change.
 *
 * The JSON data is mutated in place for performance with large files.
 */
export function executeCommand(
  json: LmbJson,
  command: EditorCommand
): UndoEntry {
  switch (command.type) {
    case "UPDATE_COLOR": {
      const color = json.resources.colors[command.index];
      if (!color) throw new Error(`Color index ${command.index} out of range`);
      const errors = validateColor(command.patch);
      if (errors.some((e) => e.severity === "error")) {
        throw new Error(errors.map((e) => e.message).join("; "));
      }
      const oldValues: Partial<ColorRgba> = {};
      for (const key of Object.keys(command.patch) as (keyof ColorRgba)[]) {
        oldValues[key] = color[key];
        (color as unknown as Record<string, number>)[key] = command.patch[key]!;
      }
      return {
        description: `Update color #${command.index}`,
        command,
        inverseCommand: { type: "UPDATE_COLOR", index: command.index, patch: oldValues },
      };
    }

    case "UPDATE_TRANSFORM": {
      const transform = json.resources.transforms[command.index];
      if (!transform) throw new Error(`Transform index ${command.index} out of range`);
      const errors = validateTransform(command.patch);
      if (errors.some((e) => e.severity === "error")) {
        throw new Error(errors.map((e) => e.message).join("; "));
      }
      const oldValues: Partial<TransformMatrix> = {};
      for (const key of Object.keys(command.patch) as (keyof TransformMatrix)[]) {
        oldValues[key] = transform[key];
        (transform as unknown as Record<string, number>)[key] = command.patch[key]!;
      }
      return {
        description: `Update transform #${command.index}`,
        command,
        inverseCommand: { type: "UPDATE_TRANSFORM", index: command.index, patch: oldValues },
      };
    }

    case "UPDATE_POSITION": {
      const position = json.resources.positions[command.index];
      if (!position) throw new Error(`Position index ${command.index} out of range`);
      const errors = validatePosition(command.patch);
      if (errors.some((e) => e.severity === "error")) {
        throw new Error(errors.map((e) => e.message).join("; "));
      }
      const oldValues: Partial<Vec2> = {};
      for (const key of Object.keys(command.patch) as (keyof Vec2)[]) {
        oldValues[key] = position[key];
        (position as unknown as Record<string, number>)[key] = command.patch[key]!;
      }
      return {
        description: `Update position #${command.index}`,
        command,
        inverseCommand: { type: "UPDATE_POSITION", index: command.index, patch: oldValues },
      };
    }

    case "UPDATE_BOUNDS": {
      const bounds = json.resources.bounds[command.index];
      if (!bounds) throw new Error(`Bounds index ${command.index} out of range`);
      const errors = validateBounds(command.patch);
      if (errors.some((e) => e.severity === "error")) {
        throw new Error(errors.map((e) => e.message).join("; "));
      }
      const oldValues: Partial<BoundsDef> = {};
      for (const key of Object.keys(command.patch) as (keyof BoundsDef)[]) {
        oldValues[key] = bounds[key] as number;
        (bounds as unknown as Record<string, number>)[key] = command.patch[key] as number;
      }
      return {
        description: `Update bounds #${command.index}`,
        command,
        inverseCommand: { type: "UPDATE_BOUNDS", index: command.index, patch: oldValues },
      };
    }

    case "UPDATE_PLACE_OBJECT": {
      const { frame } = findSpriteAndFrame(
        json,
        command.spriteCharacterId,
        command.frameIndex
      );
      const po = frame.displayList[command.placeIndex];
      if (!po) throw new Error(`PlaceObject index ${command.placeIndex} out of range`);

      const merged = { ...po, ...command.patch };
      const errors = validatePlaceObject(json, merged as PlaceObjectAction);
      if (errors.some((e) => e.severity === "error")) {
        throw new Error(errors.map((e) => e.message).join("; "));
      }

      const oldValues: Partial<PlaceObjectAction> = {};
      for (const key of Object.keys(command.patch) as (keyof PlaceObjectAction)[]) {
        (oldValues as unknown as Record<string, unknown>)[key] = (po as unknown as Record<string, unknown>)[key];
        (po as unknown as Record<string, unknown>)[key] = (command.patch as unknown as Record<string, unknown>)[key];
      }
      return {
        description: `Update placement at depth ${po.depth}`,
        command,
        inverseCommand: {
          type: "UPDATE_PLACE_OBJECT",
          spriteCharacterId: command.spriteCharacterId,
          frameIndex: command.frameIndex,
          placeIndex: command.placeIndex,
          patch: oldValues,
        },
      };
    }

    case "INSERT_PLACE_OBJECT": {
      const { frame } = findSpriteAndFrame(
        json,
        command.spriteCharacterId,
        command.frameIndex
      );
      const errors = validatePlaceObject(json, command.placeObject);
      if (errors.some((e) => e.severity === "error")) {
        throw new Error(errors.map((e) => e.message).join("; "));
      }
      frame.displayList.push(command.placeObject);
      const insertedIndex = frame.displayList.length - 1;
      return {
        description: `Insert placement at depth ${command.placeObject.depth}`,
        command,
        inverseCommand: {
          type: "DELETE_PLACE_OBJECT",
          spriteCharacterId: command.spriteCharacterId,
          frameIndex: command.frameIndex,
          placeIndex: insertedIndex,
        },
      };
    }

    case "DELETE_PLACE_OBJECT": {
      const { frame } = findSpriteAndFrame(
        json,
        command.spriteCharacterId,
        command.frameIndex
      );
      const removed = frame.displayList[command.placeIndex];
      if (!removed) throw new Error(`PlaceObject index ${command.placeIndex} out of range`);
      frame.displayList.splice(command.placeIndex, 1);
      return {
        description: `Delete placement at depth ${removed.depth}`,
        command,
        inverseCommand: {
          type: "INSERT_PLACE_OBJECT",
          spriteCharacterId: command.spriteCharacterId,
          frameIndex: command.frameIndex,
          placeObject: removed,
        },
      };
    }

    case "INSERT_REMOVE_OBJECT": {
      const { frame } = findSpriteAndFrame(
        json,
        command.spriteCharacterId,
        command.frameIndex
      );
      frame.removeList.push(command.removeObject);
      const insertedIndex = frame.removeList.length - 1;
      return {
        description: `Insert remove at depth ${command.removeObject.depth}`,
        command,
        inverseCommand: {
          type: "DELETE_REMOVE_OBJECT",
          spriteCharacterId: command.spriteCharacterId,
          frameIndex: command.frameIndex,
          removeIndex: insertedIndex,
        },
      };
    }

    case "DELETE_REMOVE_OBJECT": {
      const { frame } = findSpriteAndFrame(
        json,
        command.spriteCharacterId,
        command.frameIndex
      );
      const removed = frame.removeList[command.removeIndex];
      if (!removed) throw new Error(`RemoveObject index ${command.removeIndex} out of range`);
      frame.removeList.splice(command.removeIndex, 1);
      return {
        description: `Delete remove at depth ${removed.depth}`,
        command,
        inverseCommand: {
          type: "INSERT_REMOVE_OBJECT",
          spriteCharacterId: command.spriteCharacterId,
          frameIndex: command.frameIndex,
          removeObject: removed,
        },
      };
    }

    case "INSERT_ACTION": {
      const { frame } = findSpriteAndFrame(
        json,
        command.spriteCharacterId,
        command.frameIndex
      );
      frame.actions.push(command.action);
      const insertedIndex = frame.actions.length - 1;
      return {
        description: `Insert action ID ${command.action.actionId}`,
        command,
        inverseCommand: {
          type: "DELETE_ACTION",
          spriteCharacterId: command.spriteCharacterId,
          frameIndex: command.frameIndex,
          actionIndex: insertedIndex,
        },
      };
    }

    case "DELETE_ACTION": {
      const { frame } = findSpriteAndFrame(
        json,
        command.spriteCharacterId,
        command.frameIndex
      );
      const removed = frame.actions[command.actionIndex];
      if (!removed) throw new Error(`Action index ${command.actionIndex} out of range`);
      frame.actions.splice(command.actionIndex, 1);
      return {
        description: `Delete action ID ${removed.actionId}`,
        command,
        inverseCommand: {
          type: "INSERT_ACTION",
          spriteCharacterId: command.spriteCharacterId,
          frameIndex: command.frameIndex,
          action: removed,
        },
      };
    }
  }
}
