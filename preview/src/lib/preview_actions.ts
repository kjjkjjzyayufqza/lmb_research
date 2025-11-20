import { DoAction, SpriteDef } from './preview_runtime';

export type ActionBehavior = 
  | { type: 'GOTO_FRAME'; frameIndex: number }
  | { type: 'GOTO_LABEL'; label: string }
  | { type: 'GOTO_FIRST_LABEL' }
  | { type: 'PLAY' }
  | { type: 'STOP' }
  | { type: 'UNKNOWN' };

// Mapping from Action ID (number) to generic behavior.
// This table is intentionally minimal and conservative.
// For now, it is tuned for the known LMB files in this repo.
const ACTION_MAP: Record<number, ActionBehavior> = {
  // In ex_p_001_001_c01.json, actionId 0 is used on the root sprite (characterId 16)
  // on frameIndex 0 to enter the main labeled segment ("zenkaku", "hankaku", etc.).
  // We do not know the exact branching logic yet, so as a safe heuristic we
  // interpret it as "goto the first label and continue playing".
  0: { type: 'GOTO_FIRST_LABEL' },
};

export interface ExecutionResult {
  playing?: boolean;      // If defined, set playing state
  jumpToFrame?: number;   // If defined, jump to this frame index immediately
  log?: string;
}

export class ActionInterpreter {
  static getBehavior(actionId: number): ActionBehavior {
    return ACTION_MAP[actionId] || { type: 'UNKNOWN' };
  }

  static execute(
    action: DoAction, 
    sprite: SpriteDef
  ): ExecutionResult {
    const behavior = this.getBehavior(action.actionId);
    
    switch (behavior.type) {
      case 'STOP':
        return { playing: false, log: `Action STOP (ID ${action.actionId})` };
        
      case 'PLAY':
        return { playing: true, log: `Action PLAY (ID ${action.actionId})` };
        
      case 'GOTO_FRAME':
        return { 
          jumpToFrame: behavior.frameIndex, 
          log: `Action GOTO_FRAME ${behavior.frameIndex} (ID ${action.actionId})` 
        };
        
      case 'GOTO_LABEL': {
        const targetFrame = sprite.frameLabels[behavior.label];
        if (targetFrame !== undefined) {
          return { 
            jumpToFrame: targetFrame,
            log: `Action GOTO_LABEL "${behavior.label}" -> Frame ${targetFrame} (ID ${action.actionId})`
          };
        }
        return { 
          log: `Action GOTO_LABEL "${behavior.label}" (ID ${action.actionId}) - Label not found` 
        };
      }

      case 'GOTO_FIRST_LABEL': {
        const entries = Object.entries(sprite.frameLabels);
        if (entries.length === 0) {
          return { log: `Action GOTO_FIRST_LABEL (ID ${action.actionId}) - Sprite has no labels` };
        }

        // Pick the label whose frame index is the smallest.
        const [label, frameIndex] = entries.reduce<[string, number]>(
          (best, current) => (current[1] < best[1] ? [current[0], current[1]] : best),
          [entries[0][0], entries[0][1]]
        );

        return {
          jumpToFrame: frameIndex,
          log: `Action GOTO_FIRST_LABEL -> "${label}" (frame ${frameIndex}) (ID ${action.actionId})`,
        };
      }
        
      case 'UNKNOWN':
      default:
        // Log unknown actions just in case we want to debug them.
        return { log: `Action UNKNOWN (ID ${action.actionId})` };
    }
  }
}

