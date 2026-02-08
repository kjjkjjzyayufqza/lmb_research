import React, { createContext, useContext, useReducer, useCallback } from "react";
import type { LmbJson, SpriteDef, FrameDef, DisplayInstance } from "../lmb/types";
import { ResourceStore } from "../lmb/store";
import { Scene } from "../lmb/scene";
import { TimelinePlayer } from "../lmb/player";
import { type EditorCommand, type UndoEntry, executeCommand } from "./commands";

// ============================================================
// Editor state shape
// ============================================================

export interface EditorState {
  // Data
  json: LmbJson | null;
  resourceStore: ResourceStore | null;

  // Playback
  rootSpriteId: number;
  frameIndex: number;
  playing: boolean;
  loop: boolean;

  // Selection
  selectedDepth: number | null;
  selectedTab: "instance" | "frame" | "resources" | "export";

  // History
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  dirty: boolean;

  // Runtime (not serializable, managed outside reducer)
  scene: Scene | null;
  player: TimelinePlayer | null;
  displayInstances: DisplayInstance[];

  // Current frame data (derived from frameIndex)
  currentFrame: FrameDef | null;
  currentSprite: SpriteDef | null;
}

export const initialEditorState: EditorState = {
  json: null,
  resourceStore: null,
  rootSpriteId: 0,
  frameIndex: 0,
  playing: false,
  loop: false,
  selectedDepth: null,
  selectedTab: "instance",
  undoStack: [],
  redoStack: [],
  dirty: false,
  scene: null,
  player: null,
  displayInstances: [],
  currentFrame: null,
  currentSprite: null,
};

// ============================================================
// Actions
// ============================================================

export type EditorAction =
  | { type: "LOAD_JSON"; json: LmbJson }
  | { type: "SET_ROOT_SPRITE"; spriteId: number }
  | { type: "SET_FRAME_INDEX"; frameIndex: number }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "SET_LOOP"; loop: boolean }
  | { type: "SELECT_DEPTH"; depth: number | null }
  | { type: "SELECT_TAB"; tab: EditorState["selectedTab"] }
  | { type: "EXECUTE_COMMAND"; command: EditorCommand }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_RUNTIME"; scene: Scene; player: TimelinePlayer }
  | { type: "UPDATE_DISPLAY"; instances: DisplayInstance[]; frameIndex: number; frame: FrameDef | null }
  | { type: "MARK_CLEAN" };

const MAX_UNDO_STACK = 100;

// ============================================================
// Reducer
// ============================================================

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case "LOAD_JSON": {
      const store = new ResourceStore(action.json);
      const rootSpriteId = action.json.timeline.rootSpriteId;
      const sprite = store.getSpriteById(rootSpriteId) ?? null;
      const frame = sprite?.timeline[0] ?? null;
      return {
        ...initialEditorState,
        json: action.json,
        resourceStore: store,
        rootSpriteId,
        currentSprite: sprite,
        currentFrame: frame,
      };
    }

    case "SET_ROOT_SPRITE": {
      if (!state.resourceStore) return state;
      const sprite = state.resourceStore.getSpriteById(action.spriteId) ?? null;
      return {
        ...state,
        rootSpriteId: action.spriteId,
        frameIndex: 0,
        currentSprite: sprite,
        currentFrame: sprite?.timeline[0] ?? null,
        selectedDepth: null,
      };
    }

    case "SET_FRAME_INDEX": {
      const sprite = state.currentSprite;
      const frame = sprite?.timeline[action.frameIndex] ?? null;
      return {
        ...state,
        frameIndex: action.frameIndex,
        currentFrame: frame,
      };
    }

    case "SET_PLAYING":
      return { ...state, playing: action.playing };

    case "SET_LOOP":
      return { ...state, loop: action.loop };

    case "SELECT_DEPTH":
      return { ...state, selectedDepth: action.depth };

    case "SELECT_TAB":
      return { ...state, selectedTab: action.tab };

    case "EXECUTE_COMMAND": {
      if (!state.json) return state;
      try {
        const entry = executeCommand(state.json, action.command);
        // Rebuild resource store indexes after mutation
        state.resourceStore?.rebuildIndexes();
        const newUndo = [...state.undoStack, entry].slice(-MAX_UNDO_STACK);
        return {
          ...state,
          undoStack: newUndo,
          redoStack: [],
          dirty: true,
        };
      } catch (e) {
        console.error("Command execution failed:", e);
        return state;
      }
    }

    case "UNDO": {
      if (!state.json || state.undoStack.length === 0) return state;
      const entry = state.undoStack[state.undoStack.length - 1];
      try {
        const redoEntry = executeCommand(state.json, entry.inverseCommand);
        state.resourceStore?.rebuildIndexes();
        return {
          ...state,
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, redoEntry],
          dirty: true,
        };
      } catch (e) {
        console.error("Undo failed:", e);
        return state;
      }
    }

    case "REDO": {
      if (!state.json || state.redoStack.length === 0) return state;
      const entry = state.redoStack[state.redoStack.length - 1];
      try {
        const undoEntry = executeCommand(state.json, entry.inverseCommand);
        state.resourceStore?.rebuildIndexes();
        return {
          ...state,
          undoStack: [...state.undoStack, undoEntry],
          redoStack: state.redoStack.slice(0, -1),
          dirty: true,
        };
      } catch (e) {
        console.error("Redo failed:", e);
        return state;
      }
    }

    case "SET_RUNTIME":
      return {
        ...state,
        scene: action.scene,
        player: action.player,
      };

    case "UPDATE_DISPLAY":
      return {
        ...state,
        displayInstances: action.instances,
        frameIndex: action.frameIndex,
        currentFrame: action.frame,
      };

    case "MARK_CLEAN":
      return { ...state, dirty: false };

    default:
      return state;
  }
}

// ============================================================
// React Context
// ============================================================

interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export const EditorContext = createContext<EditorContextValue>({
  state: initialEditorState,
  dispatch: () => {},
});

export function useEditor() {
  return useContext(EditorContext);
}

export function useEditorDispatch() {
  const { dispatch } = useContext(EditorContext);
  return dispatch;
}

export function useEditorState() {
  const { state } = useContext(EditorContext);
  return state;
}

/**
 * Hook to execute an editor command with automatic undo support.
 */
export function useEditorCommand() {
  const { dispatch } = useContext(EditorContext);
  return useCallback(
    (command: EditorCommand) => {
      dispatch({ type: "EXECUTE_COMMAND", command });
    },
    [dispatch]
  );
}

export { useReducer, createContext };
