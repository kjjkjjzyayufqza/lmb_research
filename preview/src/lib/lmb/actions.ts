import type { DoAction, SpriteDef } from "./types";
import type { ResourceStore } from "./store";

/**
 * Bytecode opcodes — derived from reverse-engineering `sub_1401D2810`.
 *
 * Simple opcodes (< 0x80) are single-byte with no operands.
 * Extended opcodes (>= 0x80) follow the SWF ActionRecord format:
 *   [opcode: u8] [length_lo: u8] [length_hi: u8] [data: u8[length]]
 */
const OP = {
  END: 0x00,
  NEXT_FRAME: 0x04,
  PREV_FRAME: 0x05,
  PLAY: 0x06,
  STOP: 0x07,
  GOTO_FRAME: 0x81,    // operand: 2-byte frame index (0-based)
  GOTO_LABEL: 0x8c,    // operand: 2-byte symbol index
} as const;

/**
 * Result of executing an action's bytecodes.
 * Multiple instructions in a single action are executed sequentially;
 * later instructions can override earlier ones (e.g. gotoLabel + play).
 */
export interface ExecutionResult {
  /** If set, override the playing state of the sprite. */
  playing?: boolean;
  /** If set, perform a deterministic rebuild to this frame index (0-based). */
  jumpToFrame?: number;
  /** Human-readable log messages for debugging. */
  log?: string;
}

/**
 * ActionInterpreter executes LMB action bytecodes.
 *
 * It implements the "simple" interpreter matching engine function
 * `sub_1401D2810`.  Complex AS2 opcodes (e.g. 0x96 ActionPush) are
 * logged and skipped — they require a full AS2 VM which is out of
 * scope for the preview player.
 */
export class ActionInterpreter {
  /**
   * Execute a do_action by looking up its bytecodes in the resource
   * store and interpreting them.
   */
  static execute(
    action: DoAction,
    sprite: SpriteDef,
    resourceStore: ResourceStore,
  ): ExecutionResult {
    const bytecodes = resourceStore.getActionBytecodes(action.actionId);

    if (!bytecodes || bytecodes.length === 0) {
      // Fallback: legacy behaviour — assume actionId 0 = stop
      return this.executeLegacy(action, sprite);
    }

    return this.executeBytecodes(bytecodes, sprite, resourceStore);
  }

  /**
   * Interpret a bytecode array.  This mirrors `sub_1401D2810`:
   * - Read opcode byte
   * - Dispatch by opcode
   * - After each instruction, check if next byte is 0x00 (end)
   * - Return accumulated result
   */
  static executeBytecodes(
    bytecodes: number[],
    sprite: SpriteDef,
    resourceStore: ResourceStore,
  ): ExecutionResult {
    const result: ExecutionResult = {};
    const logs: string[] = [];
    const len = bytecodes.length;
    let pc = 0; // program counter

    // If first byte is 0x00, nothing to do
    if (len === 0 || bytecodes[0] === OP.END) {
      return { log: "Action: empty bytecode" };
    }

    const numFrames = sprite.numFrames > 0
      ? sprite.numFrames
      : sprite.timeline.length;

    while (pc < len) {
      const opcode = bytecodes[pc];
      pc += 1;

      if (opcode === OP.END) {
        break;
      }

      switch (opcode) {
        // ---- Simple opcodes (no operands) ----

        case OP.NEXT_FRAME: {
          // Engine: Tick() + stopped = true
          // In our model, we approximate by jumping forward 1 frame.
          const currentFrame = result.jumpToFrame ?? 0;
          const nextFrame = (currentFrame + 1) % numFrames;
          result.jumpToFrame = nextFrame;
          result.playing = false;
          logs.push(`nextFrame → frame ${nextFrame}`);
          break;
        }

        case OP.PREV_FRAME: {
          // Engine formula: ((numFrames + currentFrame - 1) % numFrames)
          // GotoFrame is 1-based in engine; our jumpToFrame is 0-based.
          const currentFrame = result.jumpToFrame ?? 0;
          const prevFrame = (numFrames + currentFrame - 1) % numFrames;
          result.jumpToFrame = prevFrame;
          result.playing = false;
          logs.push(`prevFrame → frame ${prevFrame}`);
          break;
        }

        case OP.PLAY: {
          result.playing = true;
          logs.push("play");
          break;
        }

        case OP.STOP: {
          result.playing = false;
          logs.push("stop");
          break;
        }

        // ---- Extended opcodes (with operands) ----

        case OP.GOTO_FRAME: {
          // Format: [0x81] [len_lo] [len_hi] [frame_lo] [frame_hi]
          if (pc + 4 > len) {
            logs.push(`gotoFrame: truncated operand at pc=${pc}`);
            return this.buildResult(result, logs);
          }
          // Skip length bytes (always 2)
          const frameLo = bytecodes[pc + 2];
          const frameHi = bytecodes[pc + 3];
          pc += 4;
          const frame = frameLo | (frameHi << 8); // 0-based
          result.jumpToFrame = frame;
          result.playing = false; // gotoAndStop by default
          logs.push(`gotoFrame(${frame})`);
          break;
        }

        case OP.GOTO_LABEL: {
          // Format: [0x8C] [len_lo] [len_hi] [sym_lo] [sym_hi]
          if (pc + 4 > len) {
            logs.push(`gotoLabel: truncated operand at pc=${pc}`);
            return this.buildResult(result, logs);
          }
          const symLo = bytecodes[pc + 2];
          const symHi = bytecodes[pc + 3];
          pc += 4;
          const symbolIndex = symLo | (symHi << 8);
          const labelName = resourceStore.getSymbolById(symbolIndex);

          if (labelName !== undefined) {
            const targetFrame = sprite.frameLabels[labelName];
            if (targetFrame !== undefined) {
              result.jumpToFrame = targetFrame;
              result.playing = false; // gotoAndStop; a subsequent play() makes it gotoAndPlay
              logs.push(`gotoLabel("${labelName}") → frame ${targetFrame}`);
            } else {
              logs.push(`gotoLabel("${labelName}") — label not found in sprite`);
            }
          } else {
            logs.push(`gotoLabel(symbolIdx=${symbolIndex}) — symbol not found`);
          }
          break;
        }

        default: {
          // Unknown/AS2 opcode — try to skip it
          if (opcode >= 0x80) {
            // Extended opcode: has length field
            if (pc + 2 > len) {
              logs.push(`Unknown extended opcode 0x${opcode.toString(16)} at pc=${pc - 1}: truncated`);
              return this.buildResult(result, logs);
            }
            const bodyLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
            pc += 2 + bodyLen;
            logs.push(`Skip AS2 opcode 0x${opcode.toString(16)} (${bodyLen + 3} bytes)`);
          } else {
            // Simple opcode with no operands — just skip
            logs.push(`Skip unknown opcode 0x${opcode.toString(16)}`);
          }
          break;
        }
      }

      // After processing an instruction, check if next byte is 0x00 (end)
      if (pc < len && bytecodes[pc] === OP.END) {
        break;
      }
    }

    return this.buildResult(result, logs);
  }

  /**
   * Legacy fallback: used when no action_script bytecodes are available.
   * This preserves the old behaviour of mapping actionId 0 → stop().
   */
  private static executeLegacy(
    action: DoAction,
    sprite: SpriteDef,
  ): ExecutionResult {
    if (action.actionId === 0) {
      return { playing: false, log: `Action STOP (legacy, ID ${action.actionId})` };
    }
    return { log: `Action UNKNOWN (legacy, ID ${action.actionId})` };
  }

  private static buildResult(result: ExecutionResult, logs: string[]): ExecutionResult {
    result.log = logs.join("; ");
    return result;
  }
}
