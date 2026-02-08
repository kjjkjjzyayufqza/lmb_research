import React, { useCallback, useState } from "react";
import { Download, Save, Check, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useEditorState, useEditorDispatch } from "@/lib/editor/state";

/**
 * ExportPanel: save or download the modified JSON.
 * Supports File System Access API for direct save, or fallback download.
 */
export function ExportPanel() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [fileName, setFileName] = useState("output.json");
  const [savedMessage, setSavedMessage] = useState("");
  const [indent, setIndent] = useState(2);

  const json = state.json;
  if (!json) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        No JSON loaded to export.
      </div>
    );
  }

  const handleDownload = useCallback(() => {
    if (!json) return;
    const text = JSON.stringify(json, null, indent);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: "MARK_CLEAN" });
    setSavedMessage("Downloaded successfully");
    setTimeout(() => setSavedMessage(""), 3000);
  }, [json, fileName, indent, dispatch]);

  const handleFileSave = useCallback(async () => {
    if (!json) return;
    try {
      // File System Access API
      if ("showSaveFilePicker" in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "JSON files",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        const text = JSON.stringify(json, null, indent);
        await writable.write(text);
        await writable.close();
        dispatch({ type: "MARK_CLEAN" });
        setSavedMessage("Saved via File System Access API");
        setTimeout(() => setSavedMessage(""), 3000);
      } else {
        // Fallback to download
        handleDownload();
      }
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
      console.error("Save failed:", e);
      setSavedMessage("Save failed: " + (e as Error).message);
      setTimeout(() => setSavedMessage(""), 5000);
    }
  }, [json, fileName, indent, dispatch, handleDownload]);

  const jsonSize = useMemo(() => {
    const text = JSON.stringify(json);
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }, [json]);

  return (
    <div className="p-3 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Export JSON
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Size:</span>
            <Badge variant="outline">{jsonSize}</Badge>
            {state.dirty && (
              <Badge variant="destructive" className="text-[10px]">
                Unsaved changes
              </Badge>
            )}
            {!state.dirty && state.undoStack.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                <Check className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div>
              <Label className="text-xs">File Name</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Indent (spaces)</Label>
              <Input
                type="number"
                min={0}
                max={8}
                value={indent}
                onChange={(e) => setIndent(Number(e.target.value))}
                className="h-8 text-xs w-20"
              />
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button onClick={handleFileSave} size="sm" className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Save As...
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {savedMessage && (
            <p className="text-xs text-green-400">{savedMessage}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Meta Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="text-muted-foreground">Stage Size</div>
            <div className="font-mono">
              {json.meta.width} x {json.meta.height}
            </div>
            <div className="text-muted-foreground">Framerate</div>
            <div className="font-mono">{json.meta.framerate} fps</div>
            <div className="text-muted-foreground">Sprites</div>
            <div className="font-mono">{json.definitions.sprites.length}</div>
            <div className="text-muted-foreground">Graphics</div>
            <div className="font-mono">{json.definitions.graphics.length}</div>
            <div className="text-muted-foreground">Texts</div>
            <div className="font-mono">{json.definitions.texts.length}</div>
            <div className="text-muted-foreground">Buttons</div>
            <div className="font-mono">{json.definitions.buttons.length}</div>
            <div className="text-muted-foreground">Undo Stack</div>
            <div className="font-mono">{state.undoStack.length}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function useMemo<T>(fn: () => T, deps: unknown[]): T {
  return React.useMemo(fn, deps);
}
