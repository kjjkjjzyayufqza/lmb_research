import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useEditorState } from "@/lib/editor/state";
import {
  LumenController,
  MachineSelectController,
  type MsData,
  type MsEntry,
} from "@/lib/lmb/lumen_controller";
import type { TimelinePlayer } from "@/lib/lmb/player";

interface Props {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}

const COST_COLORS: Record<number, string> = {
  1500: "text-green-400",
  2000: "text-blue-400",
  2500: "text-yellow-400",
  3000: "text-red-400",
};

export function MachineSelectPanel({ playerRef, onRender }: Props) {
  const state = useEditorState();
  const [msData, setMsData] = useState<MsData | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const msCtrlRef = useRef<MachineSelectController | null>(null);

  useEffect(() => {
    fetch("/gamedata/ms_data.json")
      .then((r) => r.json())
      .then((d: MsData) => setMsData(d))
      .catch((e) => console.error("Failed to load ms_data.json:", e));
  }, []);

  const scene = state.scene;
  const resourceStore = state.resourceStore;

  const initController = useCallback(() => {
    if (!scene || !resourceStore || !msData) return null;

    const addLog = (msg: string) =>
      setLogs((prev) => [...prev.slice(-29), msg]);

    const lCtrl = new LumenController(scene, resourceStore, addLog);
    const msCtrl = new MachineSelectController(lCtrl, msData, addLog);
    msCtrlRef.current = msCtrl;
    msCtrl.initialize();
    onRender();
    addLog("MachineSelectController initialized");
    return msCtrl;
  }, [scene, resourceStore, msData, onRender]);

  useEffect(() => {
    if (scene && resourceStore && msData) {
      initController();
    }
  }, [scene, resourceStore, msData, initController]);

  const handleSelect = useCallback(
    (idx: number) => {
      const ctrl = msCtrlRef.current;
      if (!ctrl) return;
      ctrl.selectByIndex(idx);
      setSelectedIdx(idx);
      onRender();
    },
    [onRender]
  );

  const handleKeyNav = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = msCtrlRef.current;
      if (!ctrl || !msData) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      let handled = true;
      switch (e.key) {
        case "ArrowUp":
        case "w":
          ctrl.selectPrev();
          break;
        case "ArrowDown":
        case "s":
          ctrl.selectNext();
          break;
        case "ArrowLeft":
        case "a":
          ctrl.pagePrev();
          break;
        case "ArrowRight":
        case "d":
          ctrl.pageNext();
          break;
        case "Enter":
        case " ":
          ctrl.triggerSelect();
          break;
        case "o":
          ctrl.triggerOpen();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        setSelectedIdx(ctrl.getSelectedIndex());
        onRender();
      }
    },
    [msData, onRender]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  const filtered = useMemo(() => {
    if (!msData) return [];
    if (!filter.trim()) return msData.characters;
    const q = filter.toLowerCase();
    return msData.characters.filter(
      (ms) =>
        ms.name.toLowerCase().includes(q) ||
        String(ms.cost).includes(q) ||
        String(ms.id).includes(q)
    );
  }, [msData, filter]);

  const selectedMs = msData?.characters[selectedIdx];

  if (!msData) {
    return (
      <div className="border-t border-border bg-card p-3 text-xs text-muted-foreground">
        Loading ms_data.json...
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card flex flex-col" style={{ maxHeight: 260 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <Crosshair className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-xs font-semibold">Machine Select</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          {msData.characters.length} MS
        </Badge>
        {selectedMs && (
          <>
            <span className={`text-xs font-bold ${COST_COLORS[selectedMs.cost] ?? ""}`}>
              {selectedMs.name}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              Cost {selectedMs.cost}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              HP {selectedMs.hp}
            </Badge>
          </>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => { msCtrlRef.current?.triggerOpen(); onRender(); }}>
          Open
        </Button>
        <Button variant="secondary" size="sm" className="h-6 text-[10px]" onClick={() => { msCtrlRef.current?.triggerSelect(); onRender(); }}>
          Confirm
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* MS List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 py-1">
            <Input
              className="h-6 text-xs"
              placeholder="Search MS..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="px-1 space-y-0.5 pb-1">
              {filtered.map((ms, fIdx) => {
                const realIdx = msData.characters.indexOf(ms);
                const isSelected = realIdx === selectedIdx;
                return (
                  <button
                    key={ms.id}
                    className={`flex items-center gap-1.5 w-full px-2 py-0.5 rounded text-[11px] transition-colors ${
                      isSelected
                        ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                    onClick={() => handleSelect(realIdx)}
                  >
                    <span className="font-mono text-[10px] w-7 shrink-0 text-right opacity-50">
                      {realIdx}
                    </span>
                    <span className="truncate flex-1 text-left">{ms.name}</span>
                    <span className={`text-[10px] font-bold ${COST_COLORS[ms.cost] ?? ""}`}>
                      {ms.cost}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 w-7 text-right">
                      {ms.hp}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Page Nav + Logs */}
        <div className="w-[200px] shrink-0 border-l border-border flex flex-col">
          <div className="flex items-center gap-1 p-1.5 border-b border-border">
            <Button variant="outline" size="icon-sm" className="h-6 w-6"
              onClick={() => { msCtrlRef.current?.pagePrev(); setSelectedIdx(msCtrlRef.current?.getSelectedIndex() ?? 0); onRender(); }}>
              <ChevronUp className="h-3 w-3" />
            </Button>
            <span className="text-[10px] text-muted-foreground flex-1 text-center tabular-nums">
              Page {Math.floor((msCtrlRef.current?.getPageOffset() ?? 0) / 10) + 1}
            </span>
            <Button variant="outline" size="icon-sm" className="h-6 w-6"
              onClick={() => { msCtrlRef.current?.pageNext(); setSelectedIdx(msCtrlRef.current?.getSelectedIndex() ?? 0); onRender(); }}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-[9px] text-muted-foreground font-semibold px-1.5 pt-1">
            Controller Log
          </div>
          <ScrollArea className="flex-1 px-1.5 pb-1">
            {logs.map((msg, i) => (
              <div
                key={i}
                className={`text-[9px] font-mono leading-tight ${
                  i === logs.length - 1 ? "text-foreground" : "text-muted-foreground/50"
                }`}
              >
                {msg}
              </div>
            ))}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
