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
    return list.map((item) => fn([item]));
  },

  filter: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    return list.filter((item) => isTruthy(fn([item])));
  },

  reduce: (args) => {
    const list = asList(args[0]);
    const initial = args[1];
    const fn = asFunction(args[2]);
    return list.reduce((acc, item) => fn([acc, item]), initial);
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
      const p = (async () => {
        const result = fn([item]);
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
