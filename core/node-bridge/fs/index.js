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
    readBinary(path) {
      const value = files.get(path);
      return Buffer.isBuffer(value) ? Buffer.from(value) : null;
    },
    writeBinary(path, value) {
      const buffer = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value);
      files.set(path, buffer);
      return { path, bytes: buffer.byteLength };
    },
    list() {
      return [...files.keys()].sort();
    },
  };
}
