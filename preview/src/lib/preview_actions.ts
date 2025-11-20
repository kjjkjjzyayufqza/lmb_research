import { DoAction, SpriteDef } from './preview_runtime';

export type ActionBehavior = 
  | { type: 'GOTO_FRAME'; frameIndex: number }
  | { type: 'GOTO_LABEL'; label: string }
  | { type: 'PLAY' }
  | { type: 'STOP' }
  | { type: 'UNKNOWN' };

// Mapping from Action ID (number) to Behavior
// This should be populated as we reverse engineer the IDs.
// For now, we can leave it empty or add placeholders.
const ACTION_MAP: Record<number, ActionBehavior> = {
  // Examples (these are hypothetical, need to be verified against real files):
  // 0: { type: 'STOP' }, 
  // 1: { type: 'PLAY' },
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
        
      case 'GOTO_LABEL':
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
        
      case 'UNKNOWN':
      default:
        // Log unknown actions just in case we want to debug them
        return { log: `Action UNKNOWN (ID ${action.actionId})` };
    }
  }
}

