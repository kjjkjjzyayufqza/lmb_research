import type { DoAction, SpriteDef, NestedSpriteInstance } from "./types";
import type { ResourceStore } from "./store";
import type { Scene } from "./scene";

// ============================================================
// Simple bytecode opcodes — from reverse-engineering `sub_1401D2810`
// ============================================================
const OP = {
  END: 0x00,
  NEXT_FRAME: 0x04,
  PREV_FRAME: 0x05,
  PLAY: 0x06,
  STOP: 0x07,
  GOTO_FRAME: 0x81,
  GOTO_LABEL: 0x8c,
} as const;

// ============================================================
// AS2 opcodes — from reverse-engineering `sub_1401D2D70`
// Complete list derived from the engine's switch table at 0x1401D6D08
// ============================================================
const AS2 = {
  // Stack operations
  ACTION_PUSH: 0x96,
  ACTION_POP: 0x17,
  ACTION_PUSH_DUPLICATE: 0x4c,
  ACTION_STACK_SWAP: 0x4d,

  // Variable / member access
  ACTION_GET_VARIABLE: 0x1c,
  ACTION_SET_VARIABLE: 0x1d,
  ACTION_GET_MEMBER: 0x4e,
  ACTION_SET_MEMBER: 0x4f,
  ACTION_GET_PROPERTY: 0x22,
  ACTION_SET_PROPERTY: 0x23,

  // Function / method calls
  ACTION_CALL_FUNCTION: 0x3d,
  ACTION_CALL_METHOD: 0x52,
  ACTION_RETURN: 0x3e,

  // Arithmetic
  ACTION_ADD: 0x0a,
  ACTION_SUBTRACT: 0x0b,
  ACTION_MULTIPLY: 0x0c,
  ACTION_DIVIDE: 0x0d,
  ACTION_MODULO: 0x3f,
  ACTION_ADD2: 0x47,
  ACTION_INCREMENT: 0x50,
  ACTION_DECREMENT: 0x51,

  // Comparison / Logic
  ACTION_EQUALS: 0x0e,
  ACTION_LESS: 0x0f,
  ACTION_AND: 0x10,
  ACTION_OR: 0x11,
  ACTION_NOT: 0x12,
  ACTION_STRING_EQUALS: 0x13,
  ACTION_STRING_LESS: 0x29,
  ACTION_EQUALS2: 0x49,
  ACTION_LESS2: 0x48,
  ACTION_GREATER: 0x67,
  ACTION_STRING_GREATER: 0x68,
  ACTION_STRICT_EQUALS: 0x66,

  // String
  ACTION_STRING_ADD: 0x21,
  ACTION_STRING_LENGTH: 0x14,
  ACTION_STRING_EXTRACT: 0x15,
  ACTION_MB_STRING_LENGTH: 0x31,
  ACTION_MB_STRING_EXTRACT: 0x35,

  // Type conversion
  ACTION_TO_INTEGER: 0x18,
  ACTION_TO_NUMBER: 0x4a,
  ACTION_TO_STRING: 0x4b,
  ACTION_TYPE_OF: 0x44,

  // Control flow
  ACTION_JUMP: 0x99,
  ACTION_IF: 0x9d,

  // Bitwise
  ACTION_BIT_AND: 0x60,
  ACTION_BIT_OR: 0x61,
  ACTION_BIT_XOR: 0x62,
  ACTION_BIT_LSHIFT: 0x63,
  ACTION_BIT_RSHIFT: 0x64,
  ACTION_BIT_URSHIFT: 0x65,

  // Object
  ACTION_NEW_OBJECT: 0x40,
  ACTION_INIT_ARRAY: 0x42,
  ACTION_INIT_OBJECT: 0x43,
  ACTION_DEFINE_LOCAL: 0x3c,
  ACTION_DEFINE_LOCAL2: 0x41,
  ACTION_DELETE: 0x3a,
  ACTION_DELETE2: 0x3b,
  ACTION_ENUMERATE: 0x46,
  ACTION_ENUMERATE2: 0x55,
  ACTION_INSTANCE_OF: 0x54,
  ACTION_TARGET_PATH: 0x45,
  ACTION_EXTENDS: 0x69,

  // Extended opcodes with operands
  ACTION_STORE_REGISTER: 0x87,
  ACTION_CONSTANT_POOL: 0x88,
  ACTION_SET_TARGET: 0x8b,
  ACTION_DEFINE_FUNCTION2: 0x8e,
  ACTION_WITH: 0x94,
  ACTION_DEFINE_FUNCTION: 0x9b,
  ACTION_GOTO_FRAME2: 0x9f,
  ACTION_GET_URL: 0x83,
  ACTION_GET_URL2: 0x9a,

  // Misc / NOP in engine
  ACTION_RANDOM_NUMBER: 0x30,
  ACTION_GET_TIME: 0x34,
  ACTION_TRACE: 0x26,
  ACTION_CHAR_TO_ASCII: 0x32,
  ACTION_ASCII_TO_CHAR: 0x33,
  ACTION_MB_CHAR_TO_ASCII: 0x36,
  ACTION_MB_ASCII_TO_CHAR: 0x37,
  ACTION_CLONE_SPRITE: 0x24,
  ACTION_REMOVE_SPRITE: 0x25,
  ACTION_SET_TARGET2: 0x20,
} as const;

// ============================================================
// ActionPush data type constants (SWF spec)
// ============================================================
const PUSH_TYPE = {
  STRING: 0,        // null-terminated string
  FLOAT: 1,         // 32-bit IEEE float
  NULL: 2,          // null
  UNDEFINED: 3,     // undefined
  REGISTER: 4,      // 1-byte register index
  BOOLEAN: 5,       // 1-byte boolean
  DOUBLE: 6,        // 64-bit IEEE double
  INTEGER: 7,       // 32-bit signed integer
  CONSTANT8: 8,     // 1-byte constant pool index
  CONSTANT16: 9,    // 2-byte constant pool index
} as const;

// ============================================================
// AS2 value types for the stack machine
// ============================================================
interface AS2MovieClipRef {
  __type: "movieclip";
  name: string;
  nested: NestedSpriteInstance;
  scene: Scene;
  resourceStore: ResourceStore;
}

type AS2Value = string | number | boolean | null | undefined | AS2MovieClipRef;

function isMovieClip(v: AS2Value): v is AS2MovieClipRef {
  return v != null && typeof v === "object" && (v as any).__type === "movieclip";
}

function toAS2String(v: AS2Value): string {
  if (v === null || v === undefined) return "";
  if (isMovieClip(v)) return v.name;
  return String(v);
}

function toAS2Number(v: AS2Value): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

function toAS2Bool(v: AS2Value): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && !isNaN(v);
  if (typeof v === "string") return v.length > 0;
  if (v === null || v === undefined) return false;
  return true; // object
}

// ============================================================
// Execution result (unchanged interface for compatibility)
// ============================================================
export interface ExecutionResult {
  playing?: boolean;
  jumpToFrame?: number;
  log?: string;
}

// ============================================================
// Execution context — provides scene access for AS2 scripts
// ============================================================
export interface AS2ExecutionContext {
  sprite: SpriteDef;
  scene: Scene;
  resourceStore: ResourceStore;
}

// ============================================================
// ActionInterpreter — executes LMB action bytecodes
// ============================================================
export class ActionInterpreter {
  /**
   * Execute a do_action by looking up its bytecodes in the resource
   * store and interpreting them.
   *
   * When a `context` is provided, AS2 opcodes (CallMethod, GetVariable,
   * etc.) can resolve child MovieClips and call methods on them.
   * Without context, AS2 opcodes are skipped (logged).
   */
  static execute(
    action: DoAction,
    sprite: SpriteDef,
    resourceStore: ResourceStore,
    context?: AS2ExecutionContext,
  ): ExecutionResult {
    const bytecodes = resourceStore.getActionBytecodes(action.actionId);

    if (!bytecodes || bytecodes.length === 0) {
      return this.executeLegacy(action, sprite);
    }

    return this.executeBytecodes(bytecodes, sprite, resourceStore, context);
  }

  /**
   * Interpret a bytecode array.
   * Simple opcodes are handled inline (matching `sub_1401D2810`).
   * AS2 opcodes use the stack machine (matching `sub_1401D2D70`).
   */
  static executeBytecodes(
    bytecodes: number[],
    sprite: SpriteDef,
    resourceStore: ResourceStore,
    context?: AS2ExecutionContext,
  ): ExecutionResult {
    const result: ExecutionResult = {};
    const logs: string[] = [];
    const len = bytecodes.length;
    let pc = 0;

    if (len === 0 || bytecodes[0] === OP.END) {
      return { log: "Action: empty bytecode" };
    }

    const numFrames = sprite.numFrames > 0
      ? sprite.numFrames
      : sprite.timeline.length;

    // When an AS2 execution context is available, always use the full AS2 VM.
    // It handles both simple opcodes (stop/play/goto) and AS2 opcodes (push/call/etc).
    if (context) {
      return this.executeAS2VM(bytecodes, sprite, resourceStore, context, logs);
    }

    // Without context, use the simple interpreter (AS2 opcodes are skipped)
    while (pc < len) {
      const opcode = bytecodes[pc];
      pc += 1;

      if (opcode === OP.END) break;

      switch (opcode) {
        case OP.NEXT_FRAME: {
          const currentFrame = result.jumpToFrame ?? 0;
          const nextFrame = (currentFrame + 1) % numFrames;
          result.jumpToFrame = nextFrame;
          result.playing = false;
          logs.push(`nextFrame → frame ${nextFrame}`);
          break;
        }

        case OP.PREV_FRAME: {
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

        case OP.GOTO_FRAME: {
          if (pc + 4 > len) {
            logs.push(`gotoFrame: truncated operand at pc=${pc}`);
            return this.buildResult(result, logs);
          }
          const frameLo = bytecodes[pc + 2];
          const frameHi = bytecodes[pc + 3];
          pc += 4;
          const frame = frameLo | (frameHi << 8);
          result.jumpToFrame = frame;
          result.playing = false;
          logs.push(`gotoFrame(${frame})`);
          break;
        }

        case OP.GOTO_LABEL: {
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
              result.playing = false;
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
          if (opcode >= 0x80) {
            if (pc + 2 > len) {
              logs.push(`Unknown extended opcode 0x${opcode.toString(16)} at pc=${pc - 1}: truncated`);
              return this.buildResult(result, logs);
            }
            const bodyLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
            pc += 2 + bodyLen;
            logs.push(`Skip AS2 opcode 0x${opcode.toString(16)} (${bodyLen + 3} bytes)`);
          } else {
            logs.push(`Skip unknown opcode 0x${opcode.toString(16)}`);
          }
          break;
        }
      }

      if (pc < len && bytecodes[pc] === OP.END) break;
    }

    return this.buildResult(result, logs);
  }

  // ============================================================
  // AS2 Stack Virtual Machine
  // ============================================================

  private static executeAS2VM(
    bytecodes: number[],
    sprite: SpriteDef,
    resourceStore: ResourceStore,
    context: AS2ExecutionContext,
    logs: string[],
  ): ExecutionResult {
    const result: ExecutionResult = {};
    const stack: AS2Value[] = [];
    const len = bytecodes.length;
    let pc = 0;

    // Constant pool — may be set by ActionConstantPool (0x88)
    // Default: use the symbol table
    let constantPool: string[] | null = null;

    // Registers (r0-r255)
    const registers: AS2Value[] = new Array(256).fill(undefined);

    const numFrames = sprite.numFrames > 0
      ? sprite.numFrames
      : sprite.timeline.length;

    /**
     * Resolve a constant index (from Constant8 or Constant16 push type).
     * If a local constant pool was set by ActionConstantPool, use that.
     * Otherwise fall back to the global symbol table.
     */
    const resolveConstant = (index: number): string => {
      if (constantPool && index < constantPool.length) {
        return constantPool[index];
      }
      return resourceStore.getSymbolById(index) ?? `<const_${index}>`;
    };

    /**
     * Resolve "this" keyword — returns a MovieClip reference to the current sprite.
     */
    const resolveThis = (): AS2MovieClipRef => ({
      __type: "movieclip",
      name: "this",
      nested: {
        placementId: -1,
        characterId: sprite.characterId,
        sprite,
        scene: context.scene,
        frameIndex: 0,
      },
      scene: context.scene,
      resourceStore,
    });

    /**
     * Resolve a variable name. Handles "this", "_root", "_parent".
     */
    const resolveVariable = (name: string): AS2Value => {
      if (name === "this") return resolveThis();
      if (name === "_root") return resolveThis(); // Approximate: treat _root as this
      // Try to find as a child clip name
      const child = context.scene.getNestedByName(name);
      if (child) {
        return {
          __type: "movieclip",
          name,
          nested: child,
          scene: child.scene,
          resourceStore,
        } as AS2MovieClipRef;
      }
      return undefined;
    };

    /**
     * Resolve member access on a MovieClip.
     */
    const resolveMember = (obj: AS2Value, memberName: string): AS2Value => {
      if (!isMovieClip(obj)) return undefined;

      // Try to find as a child clip of this movieclip's scene
      const childNested = obj.scene.getNestedByName(memberName);
      if (childNested) {
        return {
          __type: "movieclip",
          name: memberName,
          nested: childNested,
          scene: childNested.scene,
          resourceStore,
        } as AS2MovieClipRef;
      }

      // Built-in properties
      switch (memberName) {
        case "_currentframe":
          return (obj.nested.frameIndex ?? 0) + 1; // 1-based
        case "_totalframes":
          return obj.nested.sprite.numFrames || obj.nested.sprite.timeline.length;
        case "_visible":
          return obj.nested.visibleOverride !== undefined ? obj.nested.visibleOverride : true;
        case "_alpha":
          return obj.nested.alphaOverride !== undefined ? obj.nested.alphaOverride : 100;
        case "_name":
          return obj.name;
        default:
          return undefined;
      }
    };

    /**
     * Call a method on a MovieClip. Handles gotoAndPlay, gotoAndStop, play, stop.
     */
    const callMethod = (obj: AS2Value, methodName: string, args: AS2Value[]): AS2Value => {
      if (!isMovieClip(obj)) {
        logs.push(`CallMethod: object is not a MovieClip, method="${methodName}"`);
        return undefined;
      }

      const clip = obj;
      const nested = clip.nested;
      const clipSprite = nested.sprite;
      const clipScene = clip.scene;

      const playableCount = clipSprite.numFrames > 0
        ? clipSprite.numFrames
        : clipSprite.timeline.length;

      switch (methodName) {
        case "gotoAndPlay": {
          const arg = args[0];
          let targetFrame = -1;

          if (typeof arg === "string") {
            // Label-based: look up frame label
            const frameIdx = clipSprite.frameLabels[arg];
            if (frameIdx !== undefined) {
              targetFrame = frameIdx;
              logs.push(`${clip.name}.gotoAndPlay("${arg}") → frame ${targetFrame}`);
            } else {
              logs.push(`${clip.name}.gotoAndPlay("${arg}") — label not found`);
              return undefined;
            }
          } else if (typeof arg === "number") {
            // Frame number (1-based in AS2)
            targetFrame = arg - 1;
            logs.push(`${clip.name}.gotoAndPlay(${arg}) → frame ${targetFrame}`);
          }

          if (targetFrame >= 0 && targetFrame < playableCount) {
            // Deterministic rebuild to target frame
            nested.frameIndex = targetFrame;
            nested.stopped = false;
            clipScene.reset();
            for (let fi = 0; fi <= targetFrame; fi++) {
              if (fi > 0) {
                clipScene.advanceNestedSprites(resourceStore, 1);
              }
              clipScene.applyFrame(resourceStore, clipSprite.timeline[fi]);
            }

            // If this is the current sprite (self-reference), also update result
            if (nested.placementId === -1) {
              result.jumpToFrame = targetFrame;
              result.playing = true;
            }
          }
          return undefined;
        }

        case "gotoAndStop": {
          const arg = args[0];
          let targetFrame = -1;

          if (typeof arg === "string") {
            const frameIdx = clipSprite.frameLabels[arg];
            if (frameIdx !== undefined) {
              targetFrame = frameIdx;
              logs.push(`${clip.name}.gotoAndStop("${arg}") → frame ${targetFrame}`);
            } else {
              logs.push(`${clip.name}.gotoAndStop("${arg}") — label not found`);
              return undefined;
            }
          } else if (typeof arg === "number") {
            targetFrame = arg - 1;
            logs.push(`${clip.name}.gotoAndStop(${arg}) → frame ${targetFrame}`);
          }

          if (targetFrame >= 0 && targetFrame < playableCount) {
            nested.frameIndex = targetFrame;
            nested.stopped = true;
            clipScene.reset();
            for (let fi = 0; fi <= targetFrame; fi++) {
              if (fi > 0) {
                clipScene.advanceNestedSprites(resourceStore, 1);
              }
              clipScene.applyFrame(resourceStore, clipSprite.timeline[fi]);
            }

            if (nested.placementId === -1) {
              result.jumpToFrame = targetFrame;
              result.playing = false;
            }
          }
          return undefined;
        }

        case "play": {
          nested.stopped = false;
          logs.push(`${clip.name}.play()`);
          if (nested.placementId === -1) {
            result.playing = true;
          }
          return undefined;
        }

        case "stop": {
          nested.stopped = true;
          logs.push(`${clip.name}.stop()`);
          if (nested.placementId === -1) {
            result.playing = false;
          }
          return undefined;
        }

        case "nextFrame": {
          const next = (nested.frameIndex + 1) % playableCount;
          nested.frameIndex = next;
          nested.stopped = true;
          logs.push(`${clip.name}.nextFrame() → frame ${next}`);
          return undefined;
        }

        case "prevFrame": {
          const prev = (playableCount + nested.frameIndex - 1) % playableCount;
          nested.frameIndex = prev;
          nested.stopped = true;
          logs.push(`${clip.name}.prevFrame() → frame ${prev}`);
          return undefined;
        }

        default: {
          logs.push(`${clip.name}.${methodName}(${args.map(a => JSON.stringify(a)).join(", ")}) — method not implemented`);
          return undefined;
        }
      }
    };

    // ---- Main VM loop ----

    while (pc < len) {
      const opcode = bytecodes[pc];
      pc += 1;

      if (opcode === OP.END) break;

      // ---- Simple opcodes (handled inline) ----
      switch (opcode) {
        case OP.PLAY: {
          result.playing = true;
          logs.push("play");
          continue;
        }
        case OP.STOP: {
          result.playing = false;
          logs.push("stop");
          continue;
        }
        case OP.NEXT_FRAME: {
          const currentFrame = result.jumpToFrame ?? 0;
          result.jumpToFrame = (currentFrame + 1) % numFrames;
          result.playing = false;
          logs.push(`nextFrame → frame ${result.jumpToFrame}`);
          continue;
        }
        case OP.PREV_FRAME: {
          const currentFrame = result.jumpToFrame ?? 0;
          result.jumpToFrame = (numFrames + currentFrame - 1) % numFrames;
          result.playing = false;
          logs.push(`prevFrame → frame ${result.jumpToFrame}`);
          continue;
        }
        case OP.GOTO_FRAME: {
          if (pc + 4 > len) { pc = len; continue; }
          const frame = bytecodes[pc + 2] | (bytecodes[pc + 3] << 8);
          pc += 4;
          result.jumpToFrame = frame;
          result.playing = false;
          logs.push(`gotoFrame(${frame})`);
          continue;
        }
        case OP.GOTO_LABEL: {
          if (pc + 4 > len) { pc = len; continue; }
          const symIdx = bytecodes[pc + 2] | (bytecodes[pc + 3] << 8);
          pc += 4;
          const label = resourceStore.getSymbolById(symIdx);
          if (label) {
            const tf = sprite.frameLabels[label];
            if (tf !== undefined) {
              result.jumpToFrame = tf;
              result.playing = false;
              logs.push(`gotoLabel("${label}") → frame ${tf}`);
            }
          }
          continue;
        }
        default:
          break; // Fall through to AS2 handling below
      }

      // ---- AS2 opcodes ----
      switch (opcode) {
        // ---- ActionPush (0x96) ----
        case AS2.ACTION_PUSH: {
          if (pc + 2 > len) { pc = len; break; }
          const pushLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
          pc += 2;
          const pushEnd = pc + pushLen;
          while (pc < pushEnd && pc < len) {
            const pushType = bytecodes[pc];
            pc += 1;
            switch (pushType) {
              case PUSH_TYPE.STRING: {
                let str = "";
                while (pc < pushEnd && bytecodes[pc] !== 0) {
                  str += String.fromCharCode(bytecodes[pc]);
                  pc += 1;
                }
                if (pc < pushEnd) pc += 1; // skip null terminator
                stack.push(str);
                break;
              }
              case PUSH_TYPE.FLOAT: {
                if (pc + 4 > pushEnd) { pc = pushEnd; break; }
                const buf = new ArrayBuffer(4);
                const view = new DataView(buf);
                view.setUint8(0, bytecodes[pc]);
                view.setUint8(1, bytecodes[pc + 1]);
                view.setUint8(2, bytecodes[pc + 2]);
                view.setUint8(3, bytecodes[pc + 3]);
                stack.push(view.getFloat32(0, true));
                pc += 4;
                break;
              }
              case PUSH_TYPE.NULL: {
                stack.push(null);
                break;
              }
              case PUSH_TYPE.UNDEFINED: {
                stack.push(undefined);
                break;
              }
              case PUSH_TYPE.REGISTER: {
                const regIdx = bytecodes[pc];
                pc += 1;
                stack.push(registers[regIdx]);
                break;
              }
              case PUSH_TYPE.BOOLEAN: {
                stack.push(bytecodes[pc] !== 0);
                pc += 1;
                break;
              }
              case PUSH_TYPE.DOUBLE: {
                if (pc + 8 > pushEnd) { pc = pushEnd; break; }
                const dbuf = new ArrayBuffer(8);
                const dview = new DataView(dbuf);
                for (let i = 0; i < 8; i++) dview.setUint8(i, bytecodes[pc + i]);
                stack.push(dview.getFloat64(0, true));
                pc += 8;
                break;
              }
              case PUSH_TYPE.INTEGER: {
                if (pc + 4 > pushEnd) { pc = pushEnd; break; }
                const intVal = bytecodes[pc] | (bytecodes[pc + 1] << 8)
                  | (bytecodes[pc + 2] << 16) | (bytecodes[pc + 3] << 24);
                stack.push(intVal);
                pc += 4;
                break;
              }
              case PUSH_TYPE.CONSTANT8: {
                const idx = bytecodes[pc];
                pc += 1;
                stack.push(resolveConstant(idx));
                break;
              }
              case PUSH_TYPE.CONSTANT16: {
                if (pc + 2 > pushEnd) { pc = pushEnd; break; }
                const idx16 = bytecodes[pc] | (bytecodes[pc + 1] << 8);
                pc += 2;
                stack.push(resolveConstant(idx16));
                break;
              }
              default: {
                logs.push(`ActionPush: unknown type ${pushType} at pc=${pc - 1}`);
                pc = pushEnd;
                break;
              }
            }
          }
          break;
        }

        // ---- ActionPop (0x17) ----
        case AS2.ACTION_POP: {
          stack.pop();
          break;
        }

        // ---- ActionGetVariable (0x1C) ----
        case AS2.ACTION_GET_VARIABLE: {
          const varName = toAS2String(stack.pop());
          const val = resolveVariable(varName);
          stack.push(val);
          break;
        }

        // ---- ActionSetVariable (0x1D) ----
        case AS2.ACTION_SET_VARIABLE: {
          const val = stack.pop();
          const varName = toAS2String(stack.pop());
          // Variable storage not implemented — log and discard
          logs.push(`SetVariable "${varName}" = ${JSON.stringify(val)}`);
          break;
        }

        // ---- ActionGetMember (0x4E) ----
        case AS2.ACTION_GET_MEMBER: {
          const memberName = toAS2String(stack.pop());
          const obj = stack.pop();
          const memberVal = resolveMember(obj, memberName);
          stack.push(memberVal);
          break;
        }

        // ---- ActionSetMember (0x4F) ----
        case AS2.ACTION_SET_MEMBER: {
          const val = stack.pop();
          const memberName = toAS2String(stack.pop());
          const obj = stack.pop();
          if (isMovieClip(obj)) {
            const clip = obj;
            switch (memberName) {
              case "_alpha": {
                const alphaVal = toAS2Number(val);
                clip.nested.alphaOverride = alphaVal;
                logs.push(`${clip.name}._alpha = ${alphaVal}`);
                break;
              }
              case "_visible": {
                clip.nested.visibleOverride = toAS2Bool(val);
                logs.push(`${clip.name}._visible = ${val}`);
                break;
              }
              default:
                logs.push(`${clip.name}.${memberName} = ${JSON.stringify(val)}`);
                break;
            }
          } else {
            logs.push(`SetMember: non-clip object.${memberName} = ${JSON.stringify(val)}`);
          }
          break;
        }

        // ---- ActionCallMethod (0x52) ----
        case AS2.ACTION_CALL_METHOD: {
          const methodName = toAS2String(stack.pop());
          const obj = stack.pop();
          const argCount = toAS2Number(stack.pop());
          const args: AS2Value[] = [];
          for (let i = 0; i < argCount; i++) {
            args.push(stack.pop());
          }
          const retVal = callMethod(obj, methodName, args);
          stack.push(retVal);
          break;
        }

        // ---- ActionCallFunction (0x3D) ----
        case AS2.ACTION_CALL_FUNCTION: {
          const funcName = toAS2String(stack.pop());
          const argCount = toAS2Number(stack.pop());
          const args: AS2Value[] = [];
          for (let i = 0; i < argCount; i++) {
            args.push(stack.pop());
          }
          logs.push(`CallFunction ${funcName}(${args.length} args) — not implemented`);
          stack.push(undefined);
          break;
        }

        // ---- ActionReturn (0x3E) ----
        case AS2.ACTION_RETURN: {
          pc = len; // exit VM
          break;
        }

        // ---- ActionGetProperty (0x22) ----
        case AS2.ACTION_GET_PROPERTY: {
          const propIndex = toAS2Number(stack.pop());
          const target = stack.pop();
          // Simplified property lookup
          const propNames = [
            "_x", "_y", "_xscale", "_yscale", "_currentframe", "_totalframes",
            "_alpha", "_visible", "_width", "_height", "_rotation", "_target",
            "_framesloaded", "_name",
          ];
          const propName = propNames[propIndex] ?? `_prop${propIndex}`;
          if (isMovieClip(target)) {
            const val = resolveMember(target, propName);
            stack.push(val);
          } else {
            stack.push(undefined);
          }
          break;
        }

        // ---- ActionSetProperty (0x23) ----
        case AS2.ACTION_SET_PROPERTY: {
          const val = stack.pop();
          const propIndex = toAS2Number(stack.pop());
          const target = stack.pop();
          const propNames = [
            "_x", "_y", "_xscale", "_yscale", "_currentframe", "_totalframes",
            "_alpha", "_visible", "_width", "_height", "_rotation",
          ];
          const propName = propNames[propIndex] ?? `_prop${propIndex}`;
          if (isMovieClip(target)) {
            // Property index 6 = _alpha, 7 = _visible
            if (propIndex === 6) {
              const alphaVal = toAS2Number(val);
              target.nested.alphaOverride = alphaVal;
              logs.push(`SetProperty ${target.name}._alpha = ${alphaVal}`);
            } else if (propIndex === 7) {
              target.nested.visibleOverride = toAS2Bool(val);
              logs.push(`SetProperty ${target.name}._visible = ${val}`);
            } else {
              logs.push(`SetProperty ${target.name}.${propName} = ${val}`);
            }
          }
          break;
        }

        // ---- Arithmetic ----
        case AS2.ACTION_ADD:
        case AS2.ACTION_ADD2: {
          const b = stack.pop();
          const a = stack.pop();
          if (opcode === AS2.ACTION_ADD2 && (typeof a === "string" || typeof b === "string")) {
            stack.push(toAS2String(a) + toAS2String(b));
          } else {
            stack.push(toAS2Number(a) + toAS2Number(b));
          }
          break;
        }
        case AS2.ACTION_SUBTRACT: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a - b);
          break;
        }
        case AS2.ACTION_MULTIPLY: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a * b);
          break;
        }
        case AS2.ACTION_DIVIDE: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(b !== 0 ? a / b : 0);
          break;
        }
        case AS2.ACTION_MODULO: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(b !== 0 ? a % b : 0);
          break;
        }
        case AS2.ACTION_INCREMENT: {
          stack.push(toAS2Number(stack.pop()) + 1);
          break;
        }
        case AS2.ACTION_DECREMENT: {
          stack.push(toAS2Number(stack.pop()) - 1);
          break;
        }

        // ---- Comparison / Logic ----
        case AS2.ACTION_EQUALS:
        case AS2.ACTION_EQUALS2: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a == b); // loose equality for AS2 compat
          break;
        }
        case AS2.ACTION_STRICT_EQUALS: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a === b);
          break;
        }
        case AS2.ACTION_LESS:
        case AS2.ACTION_LESS2: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a < b);
          break;
        }
        case AS2.ACTION_GREATER: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a > b);
          break;
        }
        case AS2.ACTION_AND: {
          const b = toAS2Bool(stack.pop());
          const a = toAS2Bool(stack.pop());
          stack.push(a && b);
          break;
        }
        case AS2.ACTION_OR: {
          const b = toAS2Bool(stack.pop());
          const a = toAS2Bool(stack.pop());
          stack.push(a || b);
          break;
        }
        case AS2.ACTION_NOT: {
          stack.push(!toAS2Bool(stack.pop()));
          break;
        }
        case AS2.ACTION_STRING_EQUALS: {
          const b = toAS2String(stack.pop());
          const a = toAS2String(stack.pop());
          stack.push(a === b);
          break;
        }
        case AS2.ACTION_STRING_LESS:
        case AS2.ACTION_STRING_GREATER: {
          const b = toAS2String(stack.pop());
          const a = toAS2String(stack.pop());
          stack.push(opcode === AS2.ACTION_STRING_LESS ? a < b : a > b);
          break;
        }

        // ---- String ----
        case AS2.ACTION_STRING_ADD: {
          const b = toAS2String(stack.pop());
          const a = toAS2String(stack.pop());
          stack.push(a + b);
          break;
        }
        case AS2.ACTION_STRING_LENGTH:
        case AS2.ACTION_MB_STRING_LENGTH: {
          stack.push(toAS2String(stack.pop()).length);
          break;
        }

        // ---- Type conversion ----
        case AS2.ACTION_TO_INTEGER: {
          stack.push(Math.floor(toAS2Number(stack.pop())));
          break;
        }
        case AS2.ACTION_TO_NUMBER: {
          stack.push(toAS2Number(stack.pop()));
          break;
        }
        case AS2.ACTION_TO_STRING: {
          stack.push(toAS2String(stack.pop()));
          break;
        }
        case AS2.ACTION_TYPE_OF: {
          const v = stack.pop();
          if (v === null || v === undefined) stack.push("undefined");
          else if (isMovieClip(v)) stack.push("movieclip");
          else stack.push(typeof v);
          break;
        }

        // ---- Stack operations ----
        case AS2.ACTION_PUSH_DUPLICATE: {
          if (stack.length > 0) stack.push(stack[stack.length - 1]);
          break;
        }
        case AS2.ACTION_STACK_SWAP: {
          if (stack.length >= 2) {
            const top = stack[stack.length - 1];
            stack[stack.length - 1] = stack[stack.length - 2];
            stack[stack.length - 2] = top;
          }
          break;
        }

        // ---- Control flow ----
        case AS2.ACTION_JUMP: {
          // Extended opcode format: [0x99] [len_lo] [len_hi] [offset_lo] [offset_hi]
          // len should be 2; the actual branch offset is in the body
          if (pc + 2 > len) { pc = len; break; }
          const jumpBodyLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
          pc += 2; // past length field
          if (jumpBodyLen < 2 || pc + jumpBodyLen > len) { pc += jumpBodyLen; break; }
          const jumpRaw = bytecodes[pc] | (bytecodes[pc + 1] << 8);
          pc += jumpBodyLen; // past body (pc now at instruction after ActionJump)
          const jumpOffset = jumpRaw > 0x7FFF ? jumpRaw - 0x10000 : jumpRaw;
          pc += jumpOffset; // apply signed branch offset
          break;
        }
        case AS2.ACTION_IF: {
          // Extended opcode format: [0x9D] [len_lo] [len_hi] [offset_lo] [offset_hi]
          if (pc + 2 > len) { pc = len; break; }
          const ifBodyLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
          pc += 2; // past length field
          if (ifBodyLen < 2 || pc + ifBodyLen > len) { pc += ifBodyLen; break; }
          const ifRaw = bytecodes[pc] | (bytecodes[pc + 1] << 8);
          const cond = toAS2Bool(stack.pop());
          if (cond) {
            pc += ifBodyLen; // past body
            const ifOffset = ifRaw > 0x7FFF ? ifRaw - 0x10000 : ifRaw;
            pc += ifOffset; // apply signed branch offset
          } else {
            pc += ifBodyLen; // just skip past the body
          }
          break;
        }

        // ---- Bitwise ----
        case AS2.ACTION_BIT_AND: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a & b);
          break;
        }
        case AS2.ACTION_BIT_OR: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a | b);
          break;
        }
        case AS2.ACTION_BIT_XOR: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a ^ b);
          break;
        }
        case AS2.ACTION_BIT_LSHIFT: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a << b);
          break;
        }
        case AS2.ACTION_BIT_RSHIFT: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a >> b);
          break;
        }
        case AS2.ACTION_BIT_URSHIFT: {
          const b = toAS2Number(stack.pop());
          const a = toAS2Number(stack.pop());
          stack.push(a >>> b);
          break;
        }

        // ---- Store Register (0x87) ----
        case AS2.ACTION_STORE_REGISTER: {
          if (pc + 2 > len) { pc = len; break; }
          const regBodyLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
          pc += 2;
          if (regBodyLen >= 1 && pc < len) {
            const regIdx = bytecodes[pc];
            if (stack.length > 0) {
              registers[regIdx] = stack[stack.length - 1]; // peek, don't pop
            }
          }
          pc += regBodyLen;
          break;
        }

        // ---- ActionConstantPool (0x88) ----
        case AS2.ACTION_CONSTANT_POOL: {
          if (pc + 2 > len) { pc = len; break; }
          const cpLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
          pc += 2;
          const cpEnd = pc + cpLen;
          // First 2 bytes: count of constants
          if (pc + 2 <= cpEnd) {
            const cpCount = bytecodes[pc] | (bytecodes[pc + 1] << 8);
            pc += 2;
            constantPool = [];
            for (let ci = 0; ci < cpCount && pc < cpEnd; ci++) {
              let s = "";
              while (pc < cpEnd && bytecodes[pc] !== 0) {
                s += String.fromCharCode(bytecodes[pc]);
                pc += 1;
              }
              if (pc < cpEnd) pc += 1; // skip null
              constantPool.push(s);
            }
          }
          pc = cpEnd; // ensure we skip the full body
          break;
        }

        // ---- Object ops (simplified) ----
        case AS2.ACTION_INIT_ARRAY: {
          const count = toAS2Number(stack.pop());
          const arr: AS2Value[] = [];
          for (let i = 0; i < count; i++) arr.push(stack.pop());
          stack.push(undefined); // arrays not fully supported
          break;
        }
        case AS2.ACTION_INIT_OBJECT: {
          const count = toAS2Number(stack.pop());
          for (let i = 0; i < count; i++) { stack.pop(); stack.pop(); }
          stack.push(undefined); // objects not fully supported
          break;
        }
        case AS2.ACTION_NEW_OBJECT: {
          const className = toAS2String(stack.pop());
          const argCount = toAS2Number(stack.pop());
          for (let i = 0; i < argCount; i++) stack.pop();
          logs.push(`new ${className}(${argCount} args) — not implemented`);
          stack.push(undefined);
          break;
        }
        case AS2.ACTION_DEFINE_LOCAL: {
          const val = stack.pop();
          const name = toAS2String(stack.pop());
          logs.push(`DefineLocal "${name}" = ${JSON.stringify(val)}`);
          break;
        }
        case AS2.ACTION_DEFINE_LOCAL2: {
          const name = toAS2String(stack.pop());
          logs.push(`DefineLocal2 "${name}"`);
          break;
        }
        case AS2.ACTION_DELETE:
        case AS2.ACTION_DELETE2: {
          stack.pop();
          if (opcode === AS2.ACTION_DELETE) stack.pop();
          stack.push(true);
          break;
        }
        case AS2.ACTION_ENUMERATE:
        case AS2.ACTION_ENUMERATE2: {
          stack.pop();
          stack.push(null); // null terminator for enumerate
          break;
        }
        case AS2.ACTION_INSTANCE_OF: {
          stack.pop(); // constructor
          stack.pop(); // object
          stack.push(false); // simplified
          break;
        }
        case AS2.ACTION_TARGET_PATH: {
          const v = stack.pop();
          stack.push(isMovieClip(v) ? v.name : "");
          break;
        }
        case AS2.ACTION_EXTENDS: {
          stack.pop(); // super
          stack.pop(); // sub
          break;
        }

        // ---- Misc ----
        case AS2.ACTION_TRACE: {
          const msg = toAS2String(stack.pop());
          logs.push(`trace("${msg}")`);
          break;
        }
        case AS2.ACTION_RANDOM_NUMBER: {
          const max = toAS2Number(stack.pop());
          stack.push(Math.floor(Math.random() * max));
          break;
        }
        case AS2.ACTION_GET_TIME: {
          stack.push(Date.now());
          break;
        }

        // ---- NOP opcodes (toggle quality, start/end drag, etc.) ----
        case 0x08: // ToggleQuality
        case 0x09: // StopSounds
        case 0x27: // StartDrag
        case 0x28: // EndDrag
        case 0x2a: // Throw
        case 0x2b: // CastOp
        case 0x2c: // ImplementsOp
          break;

        // ---- Simple opcodes that consume stack args but aren't fully implemented ----
        case AS2.ACTION_SET_TARGET2: {
          // 0x20: pop target string, set scope (not implemented)
          stack.pop();
          logs.push("Skip SetTarget2");
          break;
        }
        case AS2.ACTION_STRING_EXTRACT:
        case AS2.ACTION_MB_STRING_EXTRACT: {
          // pop count, pop index, pop string → push substring
          stack.pop(); stack.pop();
          const strVal = toAS2String(stack.pop());
          stack.push(strVal); // return original string as fallback
          logs.push(`Skip opcode 0x${opcode.toString(16)}`);
          break;
        }
        case AS2.ACTION_CHAR_TO_ASCII:
        case AS2.ACTION_MB_CHAR_TO_ASCII: {
          // pop string → push charCode
          const ch = toAS2String(stack.pop());
          stack.push(ch.length > 0 ? ch.charCodeAt(0) : 0);
          break;
        }
        case AS2.ACTION_ASCII_TO_CHAR:
        case AS2.ACTION_MB_ASCII_TO_CHAR: {
          // pop charCode → push string
          const code = toAS2Number(stack.pop());
          stack.push(String.fromCharCode(code));
          break;
        }
        case AS2.ACTION_CLONE_SPRITE: {
          // pop depth, pop target, pop source → no push
          stack.pop(); stack.pop(); stack.pop();
          logs.push("Skip CloneSprite");
          break;
        }
        case AS2.ACTION_REMOVE_SPRITE: {
          // pop target → no push
          stack.pop();
          logs.push("Skip RemoveSprite");
          break;
        }

        // ---- Extended opcodes we skip (>= 0x80, with length prefix) ----
        case AS2.ACTION_SET_TARGET:
        case AS2.ACTION_DEFINE_FUNCTION:
        case AS2.ACTION_DEFINE_FUNCTION2:
        case AS2.ACTION_WITH:
        case AS2.ACTION_GET_URL:
        case AS2.ACTION_GET_URL2:
        case AS2.ACTION_GOTO_FRAME2: {
          if (pc + 2 > len) { pc = len; break; }
          const bodyLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
          pc += 2 + bodyLen;
          logs.push(`Skip opcode 0x${opcode.toString(16)}`);
          break;
        }

        default: {
          // Unknown opcode
          if (opcode >= 0x80) {
            if (pc + 2 > len) { pc = len; break; }
            const bodyLen = bytecodes[pc] | (bytecodes[pc + 1] << 8);
            pc += 2 + bodyLen;
            logs.push(`Skip unknown AS2 opcode 0x${opcode.toString(16)} (${bodyLen + 3} bytes)`);
          } else {
            logs.push(`Skip unknown opcode 0x${opcode.toString(16)}`);
          }
          break;
        }
      }

      // Check for end
      if (pc < len && bytecodes[pc] === OP.END) break;
      // Safety: don't loop forever
      if (pc < 0 || pc > len + 100) break;
    }

    return this.buildResult(result, logs);
  }

  // ============================================================
  // Legacy / helpers
  // ============================================================

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
