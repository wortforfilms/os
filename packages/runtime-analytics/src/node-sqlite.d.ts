// Minimal ambient types for the built-in `node:sqlite` module.
//
// node:sqlite is real and works at runtime (Node 22+), but the repo's pinned
// @types/node@20 does not yet declare it, so importing a runtime that uses it
// (runtime-persistence) trips TS2307. This shim documents the actually-used
// surface so this package typechecks. It invents no behaviour — only types.
declare module "node:sqlite" {
  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }
  export class StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean; timeout?: number });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
