export function createVirtualFileSystem() {
  const files = new Map();

  return {
    read(path) {
      return files.get(path) ?? null;
    },
    write(path, value) {
      files.set(path, value);
      return { path, bytes: Buffer.byteLength(String(value)) };
    },
    list() {
      return [...files.keys()].sort();
    },
  };
}
