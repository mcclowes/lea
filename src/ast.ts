import { Token } from "./token";

// Expression types
export type Expr =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | PipeExpr
  | ParallelPipeExpr
  | CallExpr
  | FunctionExpr
  | ListExpr
  | IndexExpr
  | PlaceholderExpr
  | AwaitExpr
  | RecordExpr
  | MemberExpr
  | TernaryExpr
  | ReturnExpr
  | TupleExpr
  | PipelineLiteral
  | ReversePipeExpr
  | BidirectionalPipelineLiteral;

export interface NumberLiteral {
  kind: "NumberLiteral";
  value: number;
}

export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
}

export interface BooleanLiteral {
  kind: "BooleanLiteral";
  value: boolean;
}

export interface Identifier {
  kind: "Identifier";
  name: string;
}

export interface BinaryExpr {
  kind: "BinaryExpr";
  operator: Token;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr {
  kind: "UnaryExpr";
  operator: Token;
  operand: Expr;
}

export interface PipeExpr {
  kind: "PipeExpr";
  left: Expr;
  right: Expr;
}

export interface ParallelPipeExpr {
  kind: "ParallelPipeExpr";
  input: Expr;
  branches: Expr[];
}

export interface CallExpr {
  kind: "CallExpr";
  callee: Expr;
  args: Expr[];
}

export interface FunctionParam {
  name: string;
  typeAnnotation?: string;  // Old style (x: Int) - deprecated
  defaultValue?: Expr;      // Default value for optional params (x = 10)
}

export interface Decorator {
  name: string;
  args: (number | string | boolean)[];
}

// Type can be a simple type name or a tuple of types
export type TypeAnnotation = string | { tuple: string[] };

// New trailing type annotation :: (Type, Type) :> ReturnType
export interface TypeSignature {
  paramTypes: (string | { tuple: string[]; optional?: boolean })[];
  returnType?: string | { tuple: string[] };
}

export interface FunctionExpr {
  kind: "FunctionExpr";
  params: FunctionParam[];
  attachments: string[];
  body: Expr | BlockBody;
  returnType?: string;  // Old style - deprecated
  typeSignature?: TypeSignature;  // New trailing :: syntax
  decorators: Decorator[];
  isReverse?: boolean;  // True if this is a reverse function definition (x) <- expr
}

export interface ListExpr {
  kind: "ListExpr";
  elements: Expr[];
}

export interface IndexExpr {
  kind: "IndexExpr";
  object: Expr;
  index: Expr;
}

export interface PlaceholderExpr {
  kind: "PlaceholderExpr";
}

export interface AwaitExpr {
  kind: "AwaitExpr";
  operand: Expr;
}

export interface RecordField {
  key: string;
  value: Expr;
}

export interface RecordExpr {
  kind: "RecordExpr";
  fields: RecordField[];
}

export interface MemberExpr {
  kind: "MemberExpr";
  object: Expr;
  member: string;
}

export interface TernaryExpr {
  kind: "TernaryExpr";
  condition: Expr;
  thenBranch: Expr;
  elseBranch: Expr;
}

export interface ReturnExpr {
  kind: "ReturnExpr";
  value: Expr;
}

export interface TupleExpr {
  kind: "TupleExpr";
  elements: Expr[];
}

// Pipeline stage - represents a single step in a pipeline
export interface PipelineStage {
  expr: Expr;  // The expression to apply (function, call, identifier, or nested pipeline)
}

// Pipeline literal - a reusable pipeline that can be assigned to a variable
// Syntax: /> fn1 /> fn2 /> fn3
export interface PipelineLiteral {
  kind: "PipelineLiteral";
  stages: PipelineStage[];
  decorators: Decorator[];
}

// Reverse pipe expression - applies a value through a pipeline in reverse
// Syntax: pipeline </ value
export interface ReversePipeExpr {
  kind: "ReversePipeExpr";
  left: Expr;   // The pipeline/function to apply in reverse
  right: Expr;  // The value to pipe through
}

// Bidirectional pipeline literal - a pipeline that can be applied in either direction
// Syntax: </> fn1 </> fn2 </> fn3
export interface BidirectionalPipelineLiteral {
  kind: "BidirectionalPipelineLiteral";
  stages: PipelineStage[];
  decorators: Decorator[];
}

export interface BlockBody {
  kind: "BlockBody";
  statements: Stmt[];
  result: Expr;
}

// Statement types
export type Stmt = LetStmt | ExprStmt | ContextDefStmt | ProvideStmt | DecoratorDefStmt | CodeblockStmt;

export interface LetStmt {
  kind: "LetStmt";
  name: string;
  mutable: boolean;
  value: Expr;
}

export interface ExprStmt {
  kind: "ExprStmt";
  expression: Expr;
}

export interface ContextDefStmt {
  kind: "ContextDefStmt";
  name: string;
  defaultValue: Expr;
}

export interface ProvideStmt {
  kind: "ProvideStmt";
  contextName: string;
  value: Expr;
}

export interface DecoratorDefStmt {
  kind: "DecoratorDefStmt";
  name: string;
  transformer: Expr;
}

export interface CodeblockStmt {
  kind: "CodeblockStmt";
  label: string | null;
  statements: Stmt[];
}

// Program
export interface Program {
  kind: "Program";
  statements: Stmt[];
}

// Helper constructors
export const numberLiteral = (value: number): NumberLiteral => ({
  kind: "NumberLiteral",
  value,
});

export const stringLiteral = (value: string): StringLiteral => ({
  kind: "StringLiteral",
  value,
});

export const booleanLiteral = (value: boolean): BooleanLiteral => ({
  kind: "BooleanLiteral",
  value,
});

export const identifier = (name: string): Identifier => ({
  kind: "Identifier",
  name,
});

export const binaryExpr = (operator: Token, left: Expr, right: Expr): BinaryExpr => ({
  kind: "BinaryExpr",
  operator,
  left,
  right,
});

export const unaryExpr = (operator: Token, operand: Expr): UnaryExpr => ({
  kind: "UnaryExpr",
  operator,
  operand,
});

export const pipeExpr = (left: Expr, right: Expr): PipeExpr => ({
  kind: "PipeExpr",
  left,
  right,
});

export const parallelPipeExpr = (input: Expr, branches: Expr[]): ParallelPipeExpr => ({
  kind: "ParallelPipeExpr",
  input,
  branches,
});

export const callExpr = (callee: Expr, args: Expr[]): CallExpr => ({
  kind: "CallExpr",
  callee,
  args,
});

export const functionExpr = (
  params: FunctionParam[],
  body: Expr | BlockBody,
  returnType?: string,
  decorators: Decorator[] = [],
  attachments: string[] = [],
  typeSignature?: TypeSignature,
  isReverse?: boolean
): FunctionExpr => ({
  kind: "FunctionExpr",
  params,
  attachments,
  body,
  returnType,
  typeSignature,
  decorators,
  isReverse,
});

export const listExpr = (elements: Expr[]): ListExpr => ({
  kind: "ListExpr",
  elements,
});

export const indexExpr = (object: Expr, index: Expr): IndexExpr => ({
  kind: "IndexExpr",
  object,
  index,
});

export const placeholderExpr = (): PlaceholderExpr => ({
  kind: "PlaceholderExpr",
});

export const awaitExpr = (operand: Expr): AwaitExpr => ({
  kind: "AwaitExpr",
  operand,
});

export const recordExpr = (fields: RecordField[]): RecordExpr => ({
  kind: "RecordExpr",
  fields,
});

export const memberExpr = (object: Expr, member: string): MemberExpr => ({
  kind: "MemberExpr",
  object,
  member,
});

export const ternaryExpr = (condition: Expr, thenBranch: Expr, elseBranch: Expr): TernaryExpr => ({
  kind: "TernaryExpr",
  condition,
  thenBranch,
  elseBranch,
});

export const returnExpr = (value: Expr): ReturnExpr => ({
  kind: "ReturnExpr",
  value,
});

export const tupleExpr = (elements: Expr[]): TupleExpr => ({
  kind: "TupleExpr",
  elements,
});

export const blockBody = (statements: Stmt[], result: Expr): BlockBody => ({
  kind: "BlockBody",
  statements,
  result,
});

export const contextDefStmt = (name: string, defaultValue: Expr): ContextDefStmt => ({
  kind: "ContextDefStmt",
  name,
  defaultValue,
});

export const provideStmt = (contextName: string, value: Expr): ProvideStmt => ({
  kind: "ProvideStmt",
  contextName,
  value,
});

export const decoratorDefStmt = (name: string, transformer: Expr): DecoratorDefStmt => ({
  kind: "DecoratorDefStmt",
  name,
  transformer,
});

export const letStmt = (name: string, mutable: boolean, value: Expr): LetStmt => ({
  kind: "LetStmt",
  name,
  mutable,
  value,
});

export const exprStmt = (expression: Expr): ExprStmt => ({
  kind: "ExprStmt",
  expression,
});

export const codeblockStmt = (label: string | null, statements: Stmt[]): CodeblockStmt => ({
  kind: "CodeblockStmt",
  label,
  statements,
});

export const program = (statements: Stmt[]): Program => ({
  kind: "Program",
  statements,
});

export const pipelineLiteral = (stages: PipelineStage[], decorators: Decorator[] = []): PipelineLiteral => ({
  kind: "PipelineLiteral",
  stages,
  decorators,
});

export const reversePipeExpr = (left: Expr, right: Expr): ReversePipeExpr => ({
  kind: "ReversePipeExpr",
  left,
  right,
});

export const bidirectionalPipelineLiteral = (stages: PipelineStage[], decorators: Decorator[] = []): BidirectionalPipelineLiteral => ({
  kind: "BidirectionalPipelineLiteral",
  stages,
  decorators,
});
