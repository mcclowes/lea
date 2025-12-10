/**
 * Interpreter re-exports
 *
 * This file maintains backward compatibility by re-exporting
 * the Interpreter class and related types from the new modular structure.
 */
export {
  Interpreter,
  LeaValue,
  LeaFunction,
  LeaBuiltin,
  LeaPromise,
  LeaRecord,
  LeaParallelResult,
  LeaTuple,
  LeaOverloadSet,
  LeaPipeline,
  LeaBidirectionalPipeline,
  LeaReversibleFunction,
  LeaReactiveValue,
  SourceLocation,
  RuntimeError,
  ReturnValue,
  Environment,
} from "./interpreter/index";
