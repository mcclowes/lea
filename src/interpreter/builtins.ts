/**
 * Built-in functions for the Lea language
 *
 * This module contains all the built-in functions available in Lea.
 */

import {
  LeaValue,
  LeaPromise,
  LeaRecord,
  LeaTuple,
  RuntimeError,
} from "./types";
import {
  asNumber,
  asList,
  asFunction,
  isTruthy,
  stringify,
  isLeaPromise,
  unwrapPromise,
  wrapPromise,
} from "./helpers";

export type BuiltinFn = (args: LeaValue[]) => LeaValue | Promise<LeaValue>;

export const builtins: Record<string, BuiltinFn> = {
  // Identity function - returns its argument unchanged (used by Pipeline.identity)
  __identity__: (args) => args[0] ?? null,

  print: (args) => {
    console.log(...args.map(stringify));
    return args[0] ?? null;
  },

  delay: (args) => {
    const ms = asNumber(args[0]);
    const value = args[1] ?? null;
    return {
      kind: "promise",
      promise: new Promise<LeaValue>((resolve) => setTimeout(() => resolve(value), ms)),
    } as LeaPromise;
  },

  sqrt: (args) => Math.sqrt(asNumber(args[0])),
  abs: (args) => Math.abs(asNumber(args[0])),
  floor: (args) => Math.floor(asNumber(args[0])),
  ceil: (args) => Math.ceil(asNumber(args[0])),
  round: (args) => Math.round(asNumber(args[0])),
  min: (args) => Math.min(...args.map(asNumber)),
  max: (args) => Math.max(...args.map(asNumber)),

  // Random number builtins
  random: () => Math.random(),
  randomInt: (args) => {
    const min = args.length === 1 ? 0 : asNumber(args[0]);
    const max = asNumber(args.length === 1 ? args[0] : args[1]);
    return Math.floor(Math.random() * (max - min)) + min;
  },
  randomFloat: (args) => {
    const min = args.length === 1 ? 0 : asNumber(args[0]);
    const max = asNumber(args.length === 1 ? args[0] : args[1]);
    return Math.random() * (max - min) + min;
  },
  randomChoice: (args) => {
    const list = asList(args[0]);
    if (list.length === 0) throw new RuntimeError("randomChoice requires a non-empty list");
    const index = Math.floor(Math.random() * list.length);
    return list[index];
  },
  shuffle: (args) => {
    const list = [...asList(args[0])];
    // Fisher-Yates shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  },

  length: (args) => {
    const val = args[0];
    if (Array.isArray(val)) return val.length;
    if (typeof val === "string") return val.length;
    throw new RuntimeError("length requires a list or string");
  },

  head: (args) => {
    const list = asList(args[0]);
    if (list.length === 0) throw new RuntimeError("head of empty list");
    return list[0];
  },

  tail: (args) => {
    const list = asList(args[0]);
    return list.slice(1);
  },

  push: (args) => {
    const list = asList(args[0]);
    return [...list, args[1]];
  },

  concat: (args) => {
    const a = asList(args[0]);
    const b = asList(args[1]);
    return [...a, ...b];
  },

  reverse: (args) => {
    const list = asList(args[0]);
    return [...list].reverse();
  },

  isEmpty: (args) => {
    const val = args[0];
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "string") return val.length === 0;
    return val === null;
  },

  fst: (args) => {
    const val = args[0];
    if (val && typeof val === "object" && "kind" in val && val.kind === "tuple") {
      return (val as LeaTuple).elements[0];
    }
    if (Array.isArray(val)) return val[0];
    throw new RuntimeError("fst expects a tuple or list");
  },

  snd: (args) => {
    const val = args[0];
    if (val && typeof val === "object" && "kind" in val && val.kind === "tuple") {
      return (val as LeaTuple).elements[1];
    }
    if (Array.isArray(val)) return val[1];
    throw new RuntimeError("snd expects a tuple or list");
  },

  zip: (args) => {
    // zip([[1,2,3], [4,5,6]]) => [[1,4], [2,5], [3,6]]
    const lists = asList(args[0]).map(asList);
    if (lists.length === 0) return [];
    const minLen = Math.min(...lists.map(l => l.length));
    const result: LeaValue[][] = [];
    for (let i = 0; i < minLen; i++) {
      result.push(lists.map(l => l[i]));
    }
    return result;
  },

  range: (args) => {
    const start = args.length === 1 ? 0 : asNumber(args[0]);
    const end = asNumber(args.length === 1 ? args[0] : args[1]);
    const result: number[] = [];
    for (let i = start; i < end; i++) result.push(i);
    return result;
  },

  iterations: (args) => {
    const count = asNumber(args[0]);
    const result: number[] = [];
    for (let i = 0; i < count; i++) result.push(i);
    return result;
  },

  map: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    return list.map((item, index) => fn([item, index]));
  },

  filter: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    return list.filter((item, index) => isTruthy(fn([item, index])));
  },

  reduce: (args) => {
    const list = asList(args[0]);
    const initial = args[1];
    const fn = asFunction(args[2]);
    return list.reduce((acc, item, index) => fn([acc, item, index]), initial);
  },

  toString: (args: LeaValue[]) => {
    const val = args[0];
    if (typeof val === "number") return String(val);
    if (typeof val === "string") return val;
    if (typeof val === "boolean") return String(val);
    if (val === null) return "null";
    return stringify(val);
  },

  take: (args: LeaValue[]) => {
    const list = asList(args[0]);
    const n = asNumber(args[1]);
    return list.slice(0, n);
  },

  at: (args: LeaValue[]) => {
    const list = asList(args[0]);
    const index = asNumber(args[1]);
    if (index < 0 || index >= list.length) {
      throw new RuntimeError(`Index ${index} out of bounds for list of length ${list.length}`);
    }
    return list[index];
  },

  // String manipulation builtins
  split: (args: LeaValue[]) => {
    const str = args[0];
    const delimiter = args[1];
    if (typeof str !== "string") {
      throw new RuntimeError("split requires a string as first argument");
    }
    if (typeof delimiter !== "string") {
      throw new RuntimeError("split requires a string delimiter");
    }
    return str.split(delimiter);
  },

  lines: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("lines requires a string");
    }
    return str.split("\n");
  },

  charAt: (args: LeaValue[]) => {
    const str = args[0];
    const index = asNumber(args[1]);
    if (typeof str !== "string") {
      throw new RuntimeError("charAt requires a string");
    }
    if (index < 0 || index >= str.length) {
      return "";
    }
    return str[index];
  },

  join: (args: LeaValue[]) => {
    const list = asList(args[0]);
    const delimiter = args[1] !== undefined ? String(args[1]) : "";
    return list.map((item) => String(item)).join(delimiter);
  },

  padEnd: (args: LeaValue[]) => {
    const str = args[0];
    const targetLength = asNumber(args[1]);
    const padChar = args[2] !== undefined ? String(args[2]) : " ";
    if (typeof str !== "string") {
      throw new RuntimeError("padEnd requires a string");
    }
    return str.padEnd(targetLength, padChar);
  },

  padStart: (args: LeaValue[]) => {
    const str = args[0];
    const targetLength = asNumber(args[1]);
    const padChar = args[2] !== undefined ? String(args[2]) : " ";
    if (typeof str !== "string") {
      throw new RuntimeError("padStart requires a string");
    }
    return str.padStart(targetLength, padChar);
  },

  trim: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("trim requires a string");
    }
    return str.trim();
  },

  trimEnd: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("trimEnd requires a string");
    }
    return str.trimEnd();
  },

  indexOf: (args: LeaValue[]) => {
    const str = args[0];
    const search = args[1];
    if (typeof str !== "string") {
      throw new RuntimeError("indexOf requires a string");
    }
    if (typeof search !== "string") {
      throw new RuntimeError("indexOf search term must be a string");
    }
    return str.indexOf(search);
  },

  includes: (args: LeaValue[]) => {
    const val = args[0];
    const search = args[1];
    if (typeof val === "string") {
      return val.includes(String(search));
    }
    if (Array.isArray(val)) {
      return val.some((item) => item === search);
    }
    throw new RuntimeError("includes requires a string or list");
  },

  repeat: (args: LeaValue[]) => {
    const str = args[0];
    const count = asNumber(args[1]);
    if (typeof str !== "string") {
      throw new RuntimeError("repeat requires a string");
    }
    return str.repeat(count);
  },

  slice: (args: LeaValue[]) => {
    const val = args[0];
    const start = asNumber(args[1]);
    const end = args[2] !== undefined ? asNumber(args[2]) : undefined;
    if (typeof val === "string") {
      return val.slice(start, end);
    }
    if (Array.isArray(val)) {
      return val.slice(start, end);
    }
    throw new RuntimeError("slice requires a string or list");
  },

  chars: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("chars requires a string");
    }
    return str.split("");
  },

  // Set-like operations on lists (for graph algorithms)
  listSet: (args: LeaValue[]) => {
    // Create a list with unique elements
    const list = asList(args[0]);
    const seen = new Set<string>();
    const result: LeaValue[] = [];
    for (const item of list) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  },

  setAdd: (args: LeaValue[]) => {
    // Add element to list if not present (returns new list)
    const list = asList(args[0]);
    const item = args[1];
    const key = JSON.stringify(item);
    for (const existing of list) {
      if (JSON.stringify(existing) === key) {
        return list;
      }
    }
    return [...list, item];
  },

  setHas: (args: LeaValue[]) => {
    // Check if element is in list
    const list = asList(args[0]);
    const item = args[1];
    const key = JSON.stringify(item);
    for (const existing of list) {
      if (JSON.stringify(existing) === key) {
        return true;
      }
    }
    return false;
  },

  // ASCII diagram parsing
  breakPieces: (args: LeaValue[]) => {
    const shape = args[0];
    if (typeof shape !== "string") {
      throw new RuntimeError("breakPieces requires a string");
    }

    const lines = shape.split("\n");
    const height = lines.length;
    if (height === 0) return [];
    const width = Math.max(...lines.map((l) => l.length));

    // Pad lines to same width
    const grid = lines.map((l) => l.padEnd(width));

    const charAt = (r: number, c: number): string => {
      if (r < 0 || r >= height || c < 0 || c >= width) return " ";
      return grid[r][c] || " ";
    };

    const isBoxChar = (ch: string): boolean => {
      return ch === "+" || ch === "-" || ch === "|";
    };

    // Mark exterior using flood fill from edges
    const exterior: boolean[][] = Array.from({ length: height }, () =>
      Array(width).fill(false)
    );

    const stack: [number, number][] = [];

    // Add all edge cells that are not box characters
    for (let c = 0; c < width; c++) {
      if (!isBoxChar(charAt(0, c))) stack.push([0, c]);
      if (!isBoxChar(charAt(height - 1, c))) stack.push([height - 1, c]);
    }
    for (let r = 0; r < height; r++) {
      if (!isBoxChar(charAt(r, 0))) stack.push([r, 0]);
      if (!isBoxChar(charAt(r, width - 1))) stack.push([r, width - 1]);
    }

    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      if (r < 0 || r >= height || c < 0 || c >= width) continue;
      if (exterior[r][c]) continue;
      if (isBoxChar(charAt(r, c))) continue;
      exterior[r][c] = true;
      stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }

    // Find interior regions
    const visited: boolean[][] = Array.from({ length: height }, () =>
      Array(width).fill(false)
    );
    const regions: [number, number][][] = [];

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (!visited[r][c] && !exterior[r][c] && !isBoxChar(charAt(r, c))) {
          const cells: [number, number][] = [];
          const stack: [number, number][] = [[r, c]];
          while (stack.length > 0) {
            const [cr, cc] = stack.pop()!;
            if (cr < 0 || cr >= height || cc < 0 || cc >= width) continue;
            if (visited[cr][cc] || exterior[cr][cc]) continue;
            if (isBoxChar(charAt(cr, cc))) continue;
            visited[cr][cc] = true;
            cells.push([cr, cc]);
            stack.push([cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]);
          }
          if (cells.length > 0) {
            regions.push(cells);
          }
        }
      }
    }

    // Extract each region as a piece
    const pieces = regions.map((region) => {
      // Find boundary cells (box chars adjacent to interior)
      // First pass: direct boundary (edges adjacent to interior)
      const directBoundary = new Set<string>();
      for (const [r, c] of region) {
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nr = r + dr,
            nc = c + dc;
          if (isBoxChar(charAt(nr, nc))) {
            directBoundary.add(`${nr},${nc}`);
          }
        }
      }

      // Second pass: expand to include corners ('+' adjacent to edges)
      // Corners are '+' characters adjacent to the direct boundary
      const boundaryCells = new Set<string>(directBoundary);
      for (const key of directBoundary) {
        const [r, c] = key.split(",").map(Number);
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nr = r + dr,
            nc = c + dc;
          const ch = charAt(nr, nc);
          if (ch === "+") {
            boundaryCells.add(`${nr},${nc}`);
          }
        }
      }

      // Determine character for each boundary cell
      // A '+' becomes '+' only if it has both horizontal and vertical continuation
      const determineChar = (r: number, c: number): string => {
        const ch = charAt(r, c);
        if (ch !== "+") return ch;

        let hasHoriz = false;
        for (const dc of [-1, 1]) {
          const key = `${r},${c + dc}`;
          if (boundaryCells.has(key)) {
            const nch = charAt(r, c + dc);
            if (nch === "-" || nch === "+") {
              hasHoriz = true;
              break;
            }
          }
        }

        let hasVert = false;
        for (const dr of [-1, 1]) {
          const key = `${r + dr},${c}`;
          if (boundaryCells.has(key)) {
            const nch = charAt(r + dr, c);
            if (nch === "|" || nch === "+") {
              hasVert = true;
              break;
            }
          }
        }

        if (hasHoriz && hasVert) return "+";
        if (hasHoriz) return "-";
        if (hasVert) return "|";
        return "+";
      };

      // Find bounding box
      let minR = Infinity,
        maxR = -Infinity,
        minC = Infinity,
        maxC = -Infinity;
      for (const [r, c] of region) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
      for (const key of boundaryCells) {
        const [r, c] = key.split(",").map(Number);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }

      // Create interior set for quick lookup
      const interiorSet = new Set(region.map(([r, c]) => `${r},${c}`));

      // Create output
      const outLines: string[] = [];
      for (let r = minR; r <= maxR; r++) {
        let line = "";
        for (let c = minC; c <= maxC; c++) {
          const key = `${r},${c}`;
          if (boundaryCells.has(key)) {
            line += determineChar(r, c);
          } else if (interiorSet.has(key)) {
            line += " ";
          } else {
            line += " ";
          }
        }
        outLines.push(line.trimEnd());
      }

      return outLines.join("\n");
    });

    return pieces;
  },

  // Concurrency builtins
  parallel: async (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    const options = args[2];

    let limit = Infinity;
    if (options && typeof options === "object" && "kind" in options && options.kind === "record") {
      const record = options as LeaRecord;
      const limitVal = record.fields.get("limit");
      if (limitVal !== undefined && typeof limitVal === "number") {
        limit = limitVal;
      }
    }

    // Execute with concurrency limit
    const results: LeaValue[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const index = i;
      const p = (async () => {
        const result = fn([item, index]);
        // If result is a promise, await it
        const unwrapped = await unwrapPromise(result);
        results[i] = unwrapped;
      })();

      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
        // Remove completed promises
        const completed = executing.filter(async (ep) => {
          try {
            await Promise.race([ep, Promise.resolve()]);
            return false;
          } catch {
            return false;
          }
        });
      }
    }

    await Promise.all(executing);
    return results;
  },

  race: async (args) => {
    const list = asList(args[0]);

    // Each element should be a function (thunk)
    const promises = list.map(async (item) => {
      const fn = asFunction(item);
      const result = fn([]);
      return unwrapPromise(result);
    });

    return Promise.race(promises);
  },

  then: (args) => {
    const promise = args[0];
    const fn = asFunction(args[1]);

    if (isLeaPromise(promise)) {
      return wrapPromise(
        promise.promise.then((val) => {
          const result = fn([val]);
          return unwrapPromise(result);
        })
      );
    }
    // If not a promise, just apply the function
    return fn([promise]);
  },
};
