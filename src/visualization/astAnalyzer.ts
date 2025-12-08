// AST Analyzer - Converts Lea AST to Flow Graph

import {
  Program,
  Stmt,
  Expr,
  PipeExpr,
  ParallelPipeExpr,
  CallExpr,
  FunctionExpr,
  Identifier,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  ListExpr,
  RecordExpr,
  TupleExpr,
  BinaryExpr,
  UnaryExpr,
  TernaryExpr,
  AwaitExpr,
  IndexExpr,
  MemberExpr,
  BlockBody,
  LetStmt,
  ReturnExpr,
} from "../ast";

import {
  FlowGraph,
  FlowNode,
  NodeId,
  createFlowGraph,
  addNode,
  addEdge,
  resetNodeIdCounter,
  createDataNode,
  createTransformNode,
  createBranchNode,
  createMergeNode,
  createBindingNode,
  createConditionNode,
  createAwaitNode,
  createDecoratorNode,
  createInputNode,
  createOutputNode,
  createPipeEdge,
  createParallelEdge,
  createMergeEdge,
  createArgumentEdge,
  TransformNode,
} from "./flowGraph";

// Analysis result containing the flow graph and any warnings
export interface AnalysisResult {
  graph: FlowGraph;
  warnings: string[];
  pipelineCount: number;
  parallelBranchCount: number;
  asyncOperationCount: number;
}

// Analyze a complete Lea program
export function analyzeProgram(program: Program, sourceName?: string): AnalysisResult {
  resetNodeIdCounter();

  const graph = createFlowGraph();
  graph.metadata.sourceFile = sourceName;

  const warnings: string[] = [];
  let pipelineCount = 0;
  let parallelBranchCount = 0;
  let asyncOperationCount = 0;

  // Process each statement
  for (const stmt of program.statements) {
    const result = analyzeStatement(stmt, graph);
    pipelineCount += result.pipelineCount;
    parallelBranchCount += result.parallelBranchCount;
    asyncOperationCount += result.asyncCount;
    warnings.push(...result.warnings);
  }

  graph.metadata.hasAsyncFlow = asyncOperationCount > 0;
  graph.metadata.hasParallelFlow = parallelBranchCount > 0;

  return {
    graph,
    warnings,
    pipelineCount,
    parallelBranchCount,
    asyncOperationCount,
  };
}

interface StatementResult {
  nodeIds: NodeId[];
  pipelineCount: number;
  parallelBranchCount: number;
  asyncCount: number;
  warnings: string[];
}

function analyzeStatement(stmt: Stmt, graph: FlowGraph): StatementResult {
  const result: StatementResult = {
    nodeIds: [],
    pipelineCount: 0,
    parallelBranchCount: 0,
    asyncCount: 0,
    warnings: [],
  };

  switch (stmt.kind) {
    case "LetStmt": {
      const bindingNode = createBindingNode(stmt.name, stmt.mutable, stmt);
      addNode(graph, bindingNode);
      result.nodeIds.push(bindingNode.id);

      // Store in variable bindings map
      graph.metadata.variableBindings.set(stmt.name, bindingNode.id);

      // Analyze the value expression
      const valueResult = analyzeExpression(stmt.value, graph);
      result.pipelineCount += valueResult.pipelineCount;
      result.parallelBranchCount += valueResult.parallelBranchCount;
      result.asyncCount += valueResult.asyncCount;
      result.warnings.push(...valueResult.warnings);

      // Connect value to binding
      if (valueResult.outputNodeId) {
        addEdge(graph, createPipeEdge(valueResult.outputNodeId, bindingNode.id, "="));
      }
      break;
    }

    case "ExprStmt": {
      const exprResult = analyzeExpression(stmt.expression, graph);
      result.nodeIds = exprResult.nodeIds;
      result.pipelineCount += exprResult.pipelineCount;
      result.parallelBranchCount += exprResult.parallelBranchCount;
      result.asyncCount += exprResult.asyncCount;
      result.warnings.push(...exprResult.warnings);
      break;
    }

    case "ContextDefStmt": {
      const contextNode = createDataNode(
        `context ${stmt.name}`,
        "record",
        undefined,
        stmt.name,
        stmt.defaultValue
      );
      contextNode.metadata.typeAnnotation = "Context";
      addNode(graph, contextNode);
      result.nodeIds.push(contextNode.id);
      graph.metadata.variableBindings.set(stmt.name, contextNode.id);
      break;
    }

    case "ProvideStmt": {
      const provideNode = createTransformNode(
        `provide ${stmt.contextName}`,
        "builtin",
        "provide",
        undefined,
        stmt.value
      );
      addNode(graph, provideNode);
      result.nodeIds.push(provideNode.id);

      // Link to context definition if exists
      const contextNodeId = graph.metadata.variableBindings.get(stmt.contextName);
      if (contextNodeId) {
        addEdge(graph, createPipeEdge(provideNode.id, contextNodeId, "override"));
      }
      break;
    }

    case "DecoratorDefStmt": {
      const decoratorDefNode = createDecoratorNode(stmt.name, [], stmt.transformer);
      decoratorDefNode.label = `decorator #${stmt.name}`;
      addNode(graph, decoratorDefNode);
      result.nodeIds.push(decoratorDefNode.id);
      break;
    }

    case "CodeblockStmt": {
      // Analyze statements inside codeblock
      for (const innerStmt of stmt.statements) {
        const innerResult = analyzeStatement(innerStmt, graph);
        result.nodeIds.push(...innerResult.nodeIds);
        result.pipelineCount += innerResult.pipelineCount;
        result.parallelBranchCount += innerResult.parallelBranchCount;
        result.asyncCount += innerResult.asyncCount;
        result.warnings.push(...innerResult.warnings);
      }
      break;
    }
  }

  return result;
}

interface ExpressionResult {
  nodeIds: NodeId[];
  outputNodeId: NodeId | null;  // The final output node of the expression
  pipelineCount: number;
  parallelBranchCount: number;
  asyncCount: number;
  warnings: string[];
}

function analyzeExpression(expr: Expr, graph: FlowGraph): ExpressionResult {
  const result: ExpressionResult = {
    nodeIds: [],
    outputNodeId: null,
    pipelineCount: 0,
    parallelBranchCount: 0,
    asyncCount: 0,
    warnings: [],
  };

  switch (expr.kind) {
    case "NumberLiteral": {
      const node = createDataNode(String(expr.value), "number", expr.value, undefined, expr);
      addNode(graph, node);
      result.nodeIds.push(node.id);
      result.outputNodeId = node.id;
      break;
    }

    case "StringLiteral": {
      const displayValue = expr.value.length > 20
        ? `"${expr.value.substring(0, 17)}..."`
        : `"${expr.value}"`;
      const node = createDataNode(displayValue, "string", expr.value, undefined, expr);
      addNode(graph, node);
      result.nodeIds.push(node.id);
      result.outputNodeId = node.id;
      break;
    }

    case "BooleanLiteral": {
      const node = createDataNode(String(expr.value), "boolean", expr.value, undefined, expr);
      addNode(graph, node);
      result.nodeIds.push(node.id);
      result.outputNodeId = node.id;
      break;
    }

    case "Identifier": {
      const node = createDataNode(expr.name, "identifier", undefined, expr.name, expr);
      addNode(graph, node);
      result.nodeIds.push(node.id);
      result.outputNodeId = node.id;

      // Check if this references a known binding
      const bindingId = graph.metadata.variableBindings.get(expr.name);
      if (bindingId) {
        addEdge(graph, {
          id: `ref_${node.id}_${bindingId}`,
          type: "binding",
          source: bindingId,
          target: node.id,
          label: "ref",
        });
      }
      break;
    }

    case "ListExpr": {
      const node = createDataNode(`[${expr.elements.length} items]`, "list", undefined, undefined, expr);
      addNode(graph, node);
      result.nodeIds.push(node.id);
      result.outputNodeId = node.id;

      // Analyze element expressions
      for (let i = 0; i < expr.elements.length; i++) {
        const elemResult = analyzeExpression(expr.elements[i], graph);
        result.nodeIds.push(...elemResult.nodeIds);
        result.pipelineCount += elemResult.pipelineCount;
        result.parallelBranchCount += elemResult.parallelBranchCount;
        result.asyncCount += elemResult.asyncCount;
        result.warnings.push(...elemResult.warnings);

        if (elemResult.outputNodeId) {
          addEdge(graph, createArgumentEdge(elemResult.outputNodeId, node.id, i));
        }
      }
      break;
    }

    case "TupleExpr": {
      const node = createDataNode(`(${expr.elements.length}-tuple)`, "tuple", undefined, undefined, expr);
      addNode(graph, node);
      result.nodeIds.push(node.id);
      result.outputNodeId = node.id;

      for (let i = 0; i < expr.elements.length; i++) {
        const elemResult = analyzeExpression(expr.elements[i], graph);
        result.nodeIds.push(...elemResult.nodeIds);
        result.pipelineCount += elemResult.pipelineCount;
        result.parallelBranchCount += elemResult.parallelBranchCount;
        result.asyncCount += elemResult.asyncCount;

        if (elemResult.outputNodeId) {
          addEdge(graph, createArgumentEdge(elemResult.outputNodeId, node.id, i));
        }
      }
      break;
    }

    case "RecordExpr": {
      const fieldNames = expr.fields.map((f) => f.key).join(", ");
      const node = createDataNode(`{ ${fieldNames} }`, "record", undefined, undefined, expr);
      addNode(graph, node);
      result.nodeIds.push(node.id);
      result.outputNodeId = node.id;

      for (let i = 0; i < expr.fields.length; i++) {
        const field = expr.fields[i];
        const fieldResult = analyzeExpression(field.value, graph);
        result.nodeIds.push(...fieldResult.nodeIds);
        result.pipelineCount += fieldResult.pipelineCount;
        result.parallelBranchCount += fieldResult.parallelBranchCount;
        result.asyncCount += fieldResult.asyncCount;

        if (fieldResult.outputNodeId) {
          addEdge(graph, {
            id: `field_${fieldResult.outputNodeId}_${node.id}_${i}`,
            type: "argument",
            source: fieldResult.outputNodeId,
            target: node.id,
            label: field.key,
            metadata: { argumentIndex: i },
          });
        }
      }
      break;
    }

    case "PipeExpr": {
      result.pipelineCount++;
      const pipeResult = analyzePipeChain(expr, graph);
      result.nodeIds = pipeResult.nodeIds;
      result.outputNodeId = pipeResult.outputNodeId;
      result.pipelineCount += pipeResult.pipelineCount;
      result.parallelBranchCount += pipeResult.parallelBranchCount;
      result.asyncCount += pipeResult.asyncCount;
      result.warnings.push(...pipeResult.warnings);
      break;
    }

    case "ParallelPipeExpr": {
      result.parallelBranchCount++;
      graph.metadata.hasParallelFlow = true;

      // Analyze input
      const inputResult = analyzeExpression(expr.input, graph);
      result.nodeIds.push(...inputResult.nodeIds);
      result.pipelineCount += inputResult.pipelineCount;
      result.parallelBranchCount += inputResult.parallelBranchCount;
      result.asyncCount += inputResult.asyncCount;

      // Create branch node
      const branchNode = createBranchNode(expr.branches.length, expr);
      addNode(graph, branchNode);
      result.nodeIds.push(branchNode.id);

      // Connect input to branch
      if (inputResult.outputNodeId) {
        addEdge(graph, createPipeEdge(inputResult.outputNodeId, branchNode.id));
      }

      // Analyze each branch
      const branchOutputIds: NodeId[] = [];
      for (let i = 0; i < expr.branches.length; i++) {
        const branchResult = analyzeExpression(expr.branches[i], graph);
        result.nodeIds.push(...branchResult.nodeIds);
        result.pipelineCount += branchResult.pipelineCount;
        result.parallelBranchCount += branchResult.parallelBranchCount;
        result.asyncCount += branchResult.asyncCount;

        // Connect branch node to each branch
        if (branchResult.nodeIds.length > 0) {
          const firstBranchNode = branchResult.nodeIds[0];
          addEdge(graph, createParallelEdge(branchNode.id, firstBranchNode, i));
        }

        if (branchResult.outputNodeId) {
          branchOutputIds.push(branchResult.outputNodeId);
        }
      }

      // Create merge node
      const mergeNode = createMergeNode(branchOutputIds.length, expr);
      addNode(graph, mergeNode);
      result.nodeIds.push(mergeNode.id);
      result.outputNodeId = mergeNode.id;

      // Connect branch outputs to merge
      for (const branchOutputId of branchOutputIds) {
        addEdge(graph, createMergeEdge(branchOutputId, mergeNode.id));
      }
      break;
    }

    case "CallExpr": {
      const callResult = analyzeCallExpr(expr, graph);
      result.nodeIds = callResult.nodeIds;
      result.outputNodeId = callResult.outputNodeId;
      result.pipelineCount += callResult.pipelineCount;
      result.parallelBranchCount += callResult.parallelBranchCount;
      result.asyncCount += callResult.asyncCount;
      result.warnings.push(...callResult.warnings);
      break;
    }

    case "FunctionExpr": {
      const funcResult = analyzeFunctionExpr(expr, graph);
      result.nodeIds = funcResult.nodeIds;
      result.outputNodeId = funcResult.outputNodeId;
      result.pipelineCount += funcResult.pipelineCount;
      result.parallelBranchCount += funcResult.parallelBranchCount;
      result.asyncCount += funcResult.asyncCount;
      result.warnings.push(...funcResult.warnings);

      // Check for async decorator
      if (expr.decorators.some((d) => d.name === "async")) {
        result.asyncCount++;
      }
      break;
    }

    case "BinaryExpr": {
      const opNode = createTransformNode(
        expr.operator.lexeme,
        "operator",
        undefined,
        expr.operator.lexeme,
        expr
      );
      addNode(graph, opNode);
      result.nodeIds.push(opNode.id);
      result.outputNodeId = opNode.id;

      // Analyze operands
      const leftResult = analyzeExpression(expr.left, graph);
      const rightResult = analyzeExpression(expr.right, graph);

      result.nodeIds.push(...leftResult.nodeIds, ...rightResult.nodeIds);
      result.pipelineCount += leftResult.pipelineCount + rightResult.pipelineCount;
      result.parallelBranchCount += leftResult.parallelBranchCount + rightResult.parallelBranchCount;
      result.asyncCount += leftResult.asyncCount + rightResult.asyncCount;

      if (leftResult.outputNodeId) {
        addEdge(graph, createArgumentEdge(leftResult.outputNodeId, opNode.id, 0));
      }
      if (rightResult.outputNodeId) {
        addEdge(graph, createArgumentEdge(rightResult.outputNodeId, opNode.id, 1));
      }
      break;
    }

    case "UnaryExpr": {
      const opNode = createTransformNode(
        expr.operator.lexeme,
        "operator",
        undefined,
        expr.operator.lexeme,
        expr
      );
      addNode(graph, opNode);
      result.nodeIds.push(opNode.id);
      result.outputNodeId = opNode.id;

      const operandResult = analyzeExpression(expr.operand, graph);
      result.nodeIds.push(...operandResult.nodeIds);
      result.pipelineCount += operandResult.pipelineCount;
      result.parallelBranchCount += operandResult.parallelBranchCount;
      result.asyncCount += operandResult.asyncCount;

      if (operandResult.outputNodeId) {
        addEdge(graph, createArgumentEdge(operandResult.outputNodeId, opNode.id, 0));
      }
      break;
    }

    case "TernaryExpr": {
      const conditionNode = createConditionNode("?", expr);
      addNode(graph, conditionNode);
      result.nodeIds.push(conditionNode.id);

      // Analyze condition
      const condResult = analyzeExpression(expr.condition, graph);
      result.nodeIds.push(...condResult.nodeIds);
      if (condResult.outputNodeId) {
        addEdge(graph, createPipeEdge(condResult.outputNodeId, conditionNode.id, "condition"));
      }

      // Analyze then branch
      const thenResult = analyzeExpression(expr.thenBranch, graph);
      result.nodeIds.push(...thenResult.nodeIds);
      if (thenResult.nodeIds.length > 0) {
        addEdge(graph, {
          id: `cond_then_${conditionNode.id}`,
          type: "condition",
          source: conditionNode.id,
          target: thenResult.nodeIds[0],
          label: "then",
        });
      }

      // Analyze else branch
      const elseResult = analyzeExpression(expr.elseBranch, graph);
      result.nodeIds.push(...elseResult.nodeIds);
      if (elseResult.nodeIds.length > 0) {
        addEdge(graph, {
          id: `cond_else_${conditionNode.id}`,
          type: "condition",
          source: conditionNode.id,
          target: elseResult.nodeIds[0],
          label: "else",
          metadata: { isElseBranch: true },
        });
      }

      // Create merge node for the outputs
      const mergeNode = createMergeNode(2, expr);
      mergeNode.label = "ternary result";
      addNode(graph, mergeNode);
      result.nodeIds.push(mergeNode.id);
      result.outputNodeId = mergeNode.id;

      if (thenResult.outputNodeId) {
        addEdge(graph, createMergeEdge(thenResult.outputNodeId, mergeNode.id));
      }
      if (elseResult.outputNodeId) {
        addEdge(graph, createMergeEdge(elseResult.outputNodeId, mergeNode.id));
      }

      result.pipelineCount += condResult.pipelineCount + thenResult.pipelineCount + elseResult.pipelineCount;
      result.parallelBranchCount += condResult.parallelBranchCount + thenResult.parallelBranchCount + elseResult.parallelBranchCount;
      result.asyncCount += condResult.asyncCount + thenResult.asyncCount + elseResult.asyncCount;
      break;
    }

    case "AwaitExpr": {
      result.asyncCount++;
      graph.metadata.hasAsyncFlow = true;

      const awaitNode = createAwaitNode(expr);
      addNode(graph, awaitNode);
      result.nodeIds.push(awaitNode.id);
      result.outputNodeId = awaitNode.id;

      const operandResult = analyzeExpression(expr.operand, graph);
      result.nodeIds.push(...operandResult.nodeIds);
      result.pipelineCount += operandResult.pipelineCount;
      result.parallelBranchCount += operandResult.parallelBranchCount;
      result.asyncCount += operandResult.asyncCount;

      if (operandResult.outputNodeId) {
        addEdge(graph, createPipeEdge(operandResult.outputNodeId, awaitNode.id));
      }
      break;
    }

    case "IndexExpr": {
      const indexNode = createTransformNode("[]", "operator", undefined, "index", expr);
      addNode(graph, indexNode);
      result.nodeIds.push(indexNode.id);
      result.outputNodeId = indexNode.id;

      const objResult = analyzeExpression(expr.object, graph);
      const idxResult = analyzeExpression(expr.index, graph);

      result.nodeIds.push(...objResult.nodeIds, ...idxResult.nodeIds);
      result.pipelineCount += objResult.pipelineCount + idxResult.pipelineCount;

      if (objResult.outputNodeId) {
        addEdge(graph, createArgumentEdge(objResult.outputNodeId, indexNode.id, 0));
      }
      if (idxResult.outputNodeId) {
        addEdge(graph, createArgumentEdge(idxResult.outputNodeId, indexNode.id, 1));
      }
      break;
    }

    case "MemberExpr": {
      const memberNode = createTransformNode(`.${expr.member}`, "operator", undefined, "member", expr);
      addNode(graph, memberNode);
      result.nodeIds.push(memberNode.id);
      result.outputNodeId = memberNode.id;

      const objResult = analyzeExpression(expr.object, graph);
      result.nodeIds.push(...objResult.nodeIds);
      result.pipelineCount += objResult.pipelineCount;

      if (objResult.outputNodeId) {
        addEdge(graph, createPipeEdge(objResult.outputNodeId, memberNode.id));
      }
      break;
    }

    case "ReturnExpr": {
      const returnNode = createOutputNode("return");
      returnNode.label = "<-";
      addNode(graph, returnNode);
      result.nodeIds.push(returnNode.id);
      result.outputNodeId = returnNode.id;

      const valueResult = analyzeExpression(expr.value, graph);
      result.nodeIds.push(...valueResult.nodeIds);
      result.pipelineCount += valueResult.pipelineCount;

      if (valueResult.outputNodeId) {
        addEdge(graph, createPipeEdge(valueResult.outputNodeId, returnNode.id));
      }
      break;
    }

    case "PlaceholderExpr": {
      const node = createDataNode("_", "identifier", undefined, "_", expr);
      node.metadata.typeAnnotation = "placeholder";
      addNode(graph, node);
      result.nodeIds.push(node.id);
      result.outputNodeId = node.id;
      break;
    }
  }

  return result;
}

// Analyze a pipe chain and flatten into sequential nodes
function analyzePipeChain(expr: PipeExpr, graph: FlowGraph): ExpressionResult {
  const result: ExpressionResult = {
    nodeIds: [],
    outputNodeId: null,
    pipelineCount: 0,
    parallelBranchCount: 0,
    asyncCount: 0,
    warnings: [],
  };

  // Collect all pipe stages
  const stages: Expr[] = [];
  let current: Expr = expr;

  while (current.kind === "PipeExpr") {
    stages.unshift((current as PipeExpr).right);
    current = (current as PipeExpr).left;
  }
  stages.unshift(current);  // The leftmost (initial) value

  // Analyze each stage and connect them
  let previousOutputId: NodeId | null = null;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const stageResult = analyzeExpression(stage, graph);

    result.nodeIds.push(...stageResult.nodeIds);
    result.pipelineCount += stageResult.pipelineCount;
    result.parallelBranchCount += stageResult.parallelBranchCount;
    result.asyncCount += stageResult.asyncCount;
    result.warnings.push(...stageResult.warnings);

    // Connect to previous stage if exists
    if (previousOutputId && stageResult.nodeIds.length > 0) {
      const firstNodeId = stageResult.nodeIds[0];
      addEdge(graph, createPipeEdge(previousOutputId, firstNodeId, "/>"));
    }

    previousOutputId = stageResult.outputNodeId;
  }

  result.outputNodeId = previousOutputId;
  return result;
}

// Analyze a function call expression
function analyzeCallExpr(expr: CallExpr, graph: FlowGraph): ExpressionResult {
  const result: ExpressionResult = {
    nodeIds: [],
    outputNodeId: null,
    pipelineCount: 0,
    parallelBranchCount: 0,
    asyncCount: 0,
    warnings: [],
  };

  // Determine function name
  let funcName = "call";
  let transformType: TransformNode["transformType"] = "call";

  if (expr.callee.kind === "Identifier") {
    funcName = expr.callee.name;

    // Recognize common builtins
    const builtins = ["map", "filter", "reduce", "print", "sqrt", "abs", "length", "head", "tail", "push", "concat", "range", "delay", "parallel", "race", "then"];
    if (builtins.includes(funcName)) {
      transformType = "builtin";
      if (funcName === "map") transformType = "map";
      else if (funcName === "filter") transformType = "filter";
      else if (funcName === "reduce") transformType = "reduce";
    }
  }

  // Create node for the call
  const callNode = createTransformNode(funcName, transformType, funcName, undefined, expr);
  addNode(graph, callNode);
  result.nodeIds.push(callNode.id);
  result.outputNodeId = callNode.id;

  // Analyze arguments
  for (let i = 0; i < expr.args.length; i++) {
    const argResult = analyzeExpression(expr.args[i], graph);
    result.nodeIds.push(...argResult.nodeIds);
    result.pipelineCount += argResult.pipelineCount;
    result.parallelBranchCount += argResult.parallelBranchCount;
    result.asyncCount += argResult.asyncCount;
    result.warnings.push(...argResult.warnings);

    if (argResult.outputNodeId) {
      addEdge(graph, createArgumentEdge(argResult.outputNodeId, callNode.id, i));
    }
  }

  return result;
}

// Analyze a function expression (lambda)
function analyzeFunctionExpr(expr: FunctionExpr, graph: FlowGraph): ExpressionResult {
  const result: ExpressionResult = {
    nodeIds: [],
    outputNodeId: null,
    pipelineCount: 0,
    parallelBranchCount: 0,
    asyncCount: 0,
    warnings: [],
  };

  // Create function node
  const paramNames = expr.params.map((p) => p.name).join(", ");
  const funcNode = createTransformNode(
    `(${paramNames}) ->`,
    "user-function",
    undefined,
    undefined,
    expr
  );

  // Add type signature if present
  if (expr.typeSignature) {
    const paramTypes = expr.typeSignature.paramTypes.map((t) =>
      typeof t === "string" ? t : `(${t.tuple.join(", ")})`
    ).join(", ");
    const returnType = expr.typeSignature.returnType
      ? typeof expr.typeSignature.returnType === "string"
        ? expr.typeSignature.returnType
        : `(${expr.typeSignature.returnType.tuple.join(", ")})`
      : "?";
    funcNode.typeSignature = expr.typeSignature;
    funcNode.metadata.typeAnnotation = `:: ${paramTypes} :> ${returnType}`;
  }

  // Add decorators
  if (expr.decorators.length > 0) {
    funcNode.metadata.decorators = expr.decorators;
    const decoratorLabels = expr.decorators.map((d) =>
      d.args.length > 0 ? `#${d.name}(${d.args.join(", ")})` : `#${d.name}`
    );
    funcNode.label += ` ${decoratorLabels.join(" ")}`;
  }

  addNode(graph, funcNode);
  result.nodeIds.push(funcNode.id);
  result.outputNodeId = funcNode.id;

  // Analyze function body
  if (expr.body.kind === "BlockBody") {
    for (const stmt of expr.body.statements) {
      const stmtResult = analyzeStatement(stmt, graph);
      result.pipelineCount += stmtResult.pipelineCount;
      result.parallelBranchCount += stmtResult.parallelBranchCount;
      result.asyncCount += stmtResult.asyncCount;
    }
    const resultExprResult = analyzeExpression(expr.body.result, graph);
    result.pipelineCount += resultExprResult.pipelineCount;
    result.parallelBranchCount += resultExprResult.parallelBranchCount;
    result.asyncCount += resultExprResult.asyncCount;
  } else {
    const bodyResult = analyzeExpression(expr.body, graph);
    result.pipelineCount += bodyResult.pipelineCount;
    result.parallelBranchCount += bodyResult.parallelBranchCount;
    result.asyncCount += bodyResult.asyncCount;
  }

  return result;
}

// Export a summary of the analysis
export function getAnalysisSummary(result: AnalysisResult): string {
  const { graph, pipelineCount, parallelBranchCount, asyncOperationCount, warnings } = result;

  const lines = [
    `=== Flow Analysis Summary ===`,
    `Nodes: ${graph.nodes.size}`,
    `Edges: ${graph.edges.length}`,
    `Pipelines: ${pipelineCount}`,
    `Parallel branches: ${parallelBranchCount}`,
    `Async operations: ${asyncOperationCount}`,
    `Variable bindings: ${graph.metadata.variableBindings.size}`,
  ];

  if (warnings.length > 0) {
    lines.push(`\nWarnings:`);
    warnings.forEach((w) => lines.push(`  - ${w}`));
  }

  return lines.join("\n");
}
