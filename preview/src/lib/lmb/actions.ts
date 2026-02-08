import type { DoAction, SpriteDef } from "./types";

export type ActionBehavior =
  | { type: "GOTO_FRAME"; frameIndex: number }
  | { type: "GOTO_LABEL"; label: string }
  | { type: "GOTO_FIRST_LABEL" }
  | { type: "PLAY" }
  | { type: "STOP" }
  | { type: "UNKNOWN" };

/**
 * Mapping from Action ID to generic behavior.
 *
 * Derived from empirical analysis of LMB files:
 *   - actionId 0 appears 286 times in machineselect.lm, always at the
 *     last frame of every labeled section, matching the classic Flash
 *     stop() pattern.
 *   - actionId 1 (1 occurrence) and actionId 2 (2 occurrences) are
 *     not yet decoded; they are logged as UNKNOWN.
 *
 * The underlying LMB binary stores a single action_script tag whose
 * bytecodes define the actual behavior per index.  Until a full
 * bytecode disassembler is implemented, this table is kept
 * conservative and only maps the patterns that have been validated.
 */
const ACTION_MAP: Record<number, ActionBehavior> = {
  0: { type: "STOP" },
};

export interface ExecutionResult {
  playing?: boolean;
  jumpToFrame?: number;
  log?: string;
}

export class ActionInterpreter {
  static getBehavior(actionId: number): ActionBehavior {
    return ACTION_MAP[actionId] || { type: "UNKNOWN" };
  }

  static execute(action: DoAction, sprite: SpriteDef): ExecutionResult {
    const behavior = this.getBehavior(action.actionId);

    switch (behavior.type) {
      case "STOP":
        return { playing: false, log: `Action STOP (ID ${action.actionId})` };

      case "PLAY":
        return { playing: true, log: `Action PLAY (ID ${action.actionId})` };

      case "GOTO_FRAME":
        return {
          jumpToFrame: behavior.frameIndex,
          log: `Action GOTO_FRAME ${behavior.frameIndex} (ID ${action.actionId})`,
        };

      case "GOTO_LABEL": {
        const targetFrame = sprite.frameLabels[behavior.label];
        if (targetFrame !== undefined) {
          return {
            jumpToFrame: targetFrame,
            log: `Action GOTO_LABEL "${behavior.label}" -> Frame ${targetFrame} (ID ${action.actionId})`,
          };
        }
        return {
          log: `Action GOTO_LABEL "${behavior.label}" (ID ${action.actionId}) - Label not found`,
        };
      }

      case "GOTO_FIRST_LABEL": {
        const entries = Object.entries(sprite.frameLabels);
        if (entries.length === 0) {
          return {
            log: `Action GOTO_FIRST_LABEL (ID ${action.actionId}) - Sprite has no labels`,
          };
        }
        const [label, frameIndex] = entries.reduce<[string, number]>(
          (best, current) =>
            current[1] < best[1] ? [current[0], current[1]] : best,
          [entries[0][0], entries[0][1]]
        );
        return {
          jumpToFrame: frameIndex,
          log: `Action GOTO_FIRST_LABEL -> "${label}" (frame ${frameIndex}) (ID ${action.actionId})`,
        };
      }

      case "UNKNOWN":
      default:
        return { log: `Action UNKNOWN (ID ${action.actionId})` };
    }
  }
}
