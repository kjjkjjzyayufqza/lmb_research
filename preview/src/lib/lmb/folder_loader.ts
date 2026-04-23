import type { LmbJson, LmbTextureBinding } from "./types";

export type LmbFolderPayload = {
  json: LmbJson;
  /** Basename -> File for every PNG under textures/ */
  textureFilesByName: Map<string, File>;
  /** Present when root contains lmb_texture_binding.json */
  textureBinding?: LmbTextureBinding;
};

const BINDING_FILENAME = "lmb_texture_binding.json";

function parseStringRecord(
  label: string,
  value: unknown
): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      `${BINDING_FILENAME}: "${label}" must be a JSON object of string keys to string values.`
    );
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== "string") {
      throw new Error(
        `${BINDING_FILENAME}: "${label}[${k}]" must be a string (PNG basename).`
      );
    }
    const t = v.trim();
    if (!t) {
      throw new Error(
        `${BINDING_FILENAME}: "${label}[${k}]" must be a non-empty string.`
      );
    }
    out[k] = t;
  }
  return out;
}

async function tryReadTextureBinding(
  root: FileSystemDirectoryHandle
): Promise<LmbTextureBinding | undefined> {
  let fh: FileSystemFileHandle;
  try {
    fh = await root.getFileHandle(BINDING_FILENAME, { create: false });
  } catch {
    return undefined;
  }
  const raw = JSON.parse(await (await fh.getFile()).text()) as unknown;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${BINDING_FILENAME} must be a JSON object.`);
  }
  const o = raw as Record<string, unknown>;
  const byAtlasId =
    o.byAtlasId !== undefined
      ? parseStringRecord("byAtlasId", o.byAtlasId)
      : {};
  const byAtlasName =
    o.byAtlasName !== undefined
      ? parseStringRecord("byAtlasName", o.byAtlasName)
      : {};
  if (Object.keys(byAtlasId).length === 0 && Object.keys(byAtlasName).length === 0) {
    throw new Error(
      `${BINDING_FILENAME} must define non-empty byAtlasId and/or byAtlasName.`
    );
  }
  const binding: LmbTextureBinding = {};
  if (Object.keys(byAtlasId).length > 0) binding.byAtlasId = byAtlasId;
  if (Object.keys(byAtlasName).length > 0) binding.byAtlasName = byAtlasName;
  return binding;
}

function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Lets the user pick a directory that contains exactly one *.json at its root
 * and a textures/ subfolder with PNG atlas files.
 */
export async function pickLmbAssetFolder(): Promise<LmbFolderPayload> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      "Folder pick is not supported in this browser. Use Chromium-based browser over https or localhost, or copy assets to preview/public/textures/ and use Open JSON."
    );
  }

  const root = await window.showDirectoryPicker({ mode: "read" });

  const jsonEntries: { name: string; file: File }[] = [];
  for await (const handle of root.values()) {
    if (handle.kind !== "file") continue;
    const name = handle.name;
    if (!name.toLowerCase().endsWith(".json")) continue;
    const file = await handle.getFile();
    jsonEntries.push({ name, file });
  }

  jsonEntries.sort((a, b) => a.name.localeCompare(b.name));

  if (jsonEntries.length === 0) {
    throw new Error(
      "No JSON file found in the selected folder. Place exactly one *.json at the folder root."
    );
  }
  if (jsonEntries.length > 1) {
    const names = jsonEntries.map((e) => e.name).join(", ");
    throw new Error(
      `Expected exactly one JSON file at the folder root, found: ${names}`
    );
  }

  const text = await jsonEntries[0].file.text();
  const json = JSON.parse(text) as LmbJson;

  let texDir: FileSystemDirectoryHandle;
  try {
    texDir = await root.getDirectoryHandle("textures", { create: false });
  } catch {
    throw new Error(
      'Missing "textures" subfolder next to the JSON file. Expected: <folder>/textures/*.png'
    );
  }

  const textureFilesByName = new Map<string, File>();
  for await (const handle of texDir.values()) {
    if (handle.kind !== "file") continue;
    const name = handle.name;
    if (!name.toLowerCase().endsWith(".png")) continue;
    textureFilesByName.set(name, await handle.getFile());
  }

  if (textureFilesByName.size === 0) {
    throw new Error('No PNG files found under the "textures" folder.');
  }

  const textureBinding = await tryReadTextureBinding(root);

  return { json, textureFilesByName, textureBinding };
}
