/**
 * File System Access API (Chromium). Older DOM libs omit these declarations.
 */
export {};

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: "read" | "readwrite";
    }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
  }
}
