import { Lexer } from '../src/lexer';
import { Parser, ParseError } from '../src/parser';
import { Program, Expr, Stmt } from '../src/ast';

describe('Parser', () => {
  const parse = (source: string): Program => {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    return parser.parse();
  };

  const parseExpr = (source: string): Expr => {
    const program = parse(source);
    const stmt = program.statements[0];
    if (stmt.kind === 'ExprStmt') {
      return stmt.expression;
    }
    throw new Error('Expected ExprStmt');
  };

  const parseStmt = (source: string): Stmt => {
    const program = parse(source);
    return program.statements[0];
  };

  describe('literals', () => {
    it('should parse number literals', () => {
      const expr = parseExpr('42');
      expect(expr.kind).toBe('NumberLiteral');
      if (expr.kind === 'NumberLiteral') {
        expect(expr.value).toBe(42);
      }
    });

    it('should parse float literals', () => {
      const expr = parseExpr('3.14');
      expect(expr.kind).toBe('NumberLiteral');
      if (expr.kind === 'NumberLiteral') {
        expect(expr.value).toBe(3.14);
      }
    });

    it('should parse string literals', () => {
      const expr = parseExpr('"hello"');
      expect(expr.kind).toBe('StringLiteral');
      if (expr.kind === 'StringLiteral') {
        expect(expr.value).toBe('hello');
      }
    });

    it('should parse boolean literals', () => {
      expect(parseExpr('true').kind).toBe('BooleanLiteral');
      expect(parseExpr('false').kind).toBe('BooleanLiteral');

      const trueExpr = parseExpr('true');
      if (trueExpr.kind === 'BooleanLiteral') {
        expect(trueExpr.value).toBe(true);
      }

      const falseExpr = parseExpr('false');
      if (falseExpr.kind === 'BooleanLiteral') {
        expect(falseExpr.value).toBe(false);
      }
    });

    it('should parse template strings', () => {
      const expr = parseExpr('`hello {name}`');
      expect(expr.kind).toBe('TemplateStringExpr');
      if (expr.kind === 'TemplateStringExpr') {
        expect(expr.parts.length).toBe(3);
        expect(expr.parts[0]).toBe('hello ');
        expect((expr.parts[1] as Expr).kind).toBe('Identifier');
        expect(expr.parts[2]).toBe('');
      }
    });
  });

  describe('identifiers', () => {
    it('should parse identifiers', () => {
      const expr = parseExpr('foo');
      expect(expr.kind).toBe('Identifier');
      if (expr.kind === 'Identifier') {
        expect(expr.name).toBe('foo');
      }
    });

    it('should parse input keyword as placeholder', () => {
      // 'input' is a special keyword that maps to PlaceholderExpr
      const expr = parseExpr('input');
      expect(expr.kind).toBe('PlaceholderExpr');
    });

    it('should parse underscore in function parameters', () => {
      // _ is valid as a function parameter (ignored param)
      const expr = parseExpr('(_, y) -> y');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.params[0].name).toBe('_');
      }
    });
  });

  describe('binary expressions', () => {
    it('should parse arithmetic expressions', () => {
      const expr = parseExpr('1 + 2');
      expect(expr.kind).toBe('BinaryExpr');
      if (expr.kind === 'BinaryExpr') {
        expect(expr.left.kind).toBe('NumberLiteral');
        expect(expr.right.kind).toBe('NumberLiteral');
      }
    });

    it('should respect operator precedence for arithmetic', () => {
      const expr = parseExpr('1 + 2 * 3');
      expect(expr.kind).toBe('BinaryExpr');
      if (expr.kind === 'BinaryExpr') {
        expect(expr.left.kind).toBe('NumberLiteral');
        // Right side should be 2 * 3
        expect(expr.right.kind).toBe('BinaryExpr');
      }
    });

    it('should parse comparison expressions', () => {
      const expr = parseExpr('x == y');
      expect(expr.kind).toBe('BinaryExpr');
      if (expr.kind === 'BinaryExpr') {
        expect(expr.operator.lexeme).toBe('==');
      }
    });

    it('should parse concatenation', () => {
      const expr = parseExpr('"a" ++ "b"');
      expect(expr.kind).toBe('BinaryExpr');
      if (expr.kind === 'BinaryExpr') {
        expect(expr.operator.lexeme).toBe('++');
      }
    });
  });

  describe('unary expressions', () => {
    it('should parse negative numbers', () => {
      const expr = parseExpr('-42');
      expect(expr.kind).toBe('UnaryExpr');
      if (expr.kind === 'UnaryExpr') {
        expect(expr.operator.lexeme).toBe('-');
        expect(expr.operand.kind).toBe('NumberLiteral');
      }
    });
  });

  describe('pipe expressions', () => {
    it('should parse simple pipe', () => {
      const expr = parseExpr('5 /> double');
      expect(expr.kind).toBe('PipeExpr');
      if (expr.kind === 'PipeExpr') {
        expect(expr.left.kind).toBe('NumberLiteral');
        expect(expr.right.kind).toBe('Identifier');
      }
    });

    it('should parse pipe chain', () => {
      const expr = parseExpr('5 /> double /> print');
      expect(expr.kind).toBe('PipeExpr');
      if (expr.kind === 'PipeExpr') {
        expect(expr.left.kind).toBe('PipeExpr');
        expect(expr.right.kind).toBe('Identifier');
      }
    });

    it('should parse pipe with function call', () => {
      const expr = parseExpr('5 /> add(3)');
      expect(expr.kind).toBe('PipeExpr');
      if (expr.kind === 'PipeExpr') {
        expect(expr.right.kind).toBe('CallExpr');
      }
    });

    it('should parse spread pipe', () => {
      const expr = parseExpr('[1, 2, 3] />>> double');
      expect(expr.kind).toBe('SpreadPipeExpr');
    });

    it('should parse reverse pipe', () => {
      const expr = parseExpr('10 </ double');
      expect(expr.kind).toBe('ReversePipeExpr');
    });
  });

  describe('call expressions', () => {
    it('should parse function call with no arguments', () => {
      const expr = parseExpr('foo()');
      expect(expr.kind).toBe('CallExpr');
      if (expr.kind === 'CallExpr') {
        expect(expr.callee.kind).toBe('Identifier');
        expect(expr.args.length).toBe(0);
      }
    });

    it('should parse function call with arguments', () => {
      const expr = parseExpr('add(1, 2)');
      expect(expr.kind).toBe('CallExpr');
      if (expr.kind === 'CallExpr') {
        expect(expr.args.length).toBe(2);
      }
    });

    it('should parse function call with input placeholder', () => {
      // 'input' is the placeholder keyword for piped values
      const expr = parseExpr('add(3, input)');
      expect(expr.kind).toBe('CallExpr');
      if (expr.kind === 'CallExpr') {
        expect(expr.args[1].kind).toBe('PlaceholderExpr');
      }
    });
  });

  describe('function expressions', () => {
    it('should parse simple function', () => {
      const expr = parseExpr('(x) -> x * 2');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.params.length).toBe(1);
        expect(expr.params[0].name).toBe('x');
        expect(expr.body.kind).toBe('BinaryExpr');
      }
    });

    it('should parse function with multiple parameters', () => {
      const expr = parseExpr('(a, b) -> a + b');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.params.length).toBe(2);
        expect(expr.params[0].name).toBe('a');
        expect(expr.params[1].name).toBe('b');
      }
    });

    it('should parse function with default parameter', () => {
      const expr = parseExpr('(x, y = 10) -> x + y');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.params[1].defaultValue).toBeDefined();
      }
    });

    it('should parse function with type signature', () => {
      const expr = parseExpr('(x) -> x * 2 :: Int :> Int');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.typeSignature).toBeDefined();
        expect(expr.typeSignature?.paramTypes).toEqual(['Int']);
        expect(expr.typeSignature?.returnType).toBe('Int');
      }
    });

    it('should parse function with decorators', () => {
      const expr = parseExpr('(x) -> x * 2 #log #memo');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.decorators.length).toBe(2);
        expect(expr.decorators[0].name).toBe('log');
        expect(expr.decorators[1].name).toBe('memo');
      }
    });

    it('should parse function with decorator arguments', () => {
      const expr = parseExpr('(x) -> riskyOp(x) #retry(3)');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.decorators[0].name).toBe('retry');
        expect(expr.decorators[0].args).toEqual([3]);
      }
    });

    it('should parse reverse function', () => {
      const expr = parseExpr('(x) <- x / 2');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.isReverse).toBe(true);
      }
    });

    it('should parse function with ignored parameter', () => {
      const expr = parseExpr('(x, _) -> x');
      expect(expr.kind).toBe('FunctionExpr');
      if (expr.kind === 'FunctionExpr') {
        expect(expr.params[1].name).toBe('_');
      }
    });
  });

  describe('list expressions', () => {
    it('should parse empty list', () => {
      const expr = parseExpr('[]');
      expect(expr.kind).toBe('ListExpr');
      if (expr.kind === 'ListExpr') {
        expect(expr.elements.length).toBe(0);
      }
    });

    it('should parse list with elements', () => {
      const expr = parseExpr('[1, 2, 3]');
      expect(expr.kind).toBe('ListExpr');
      if (expr.kind === 'ListExpr') {
        expect(expr.elements.length).toBe(3);
      }
    });

    it('should parse list with spread', () => {
      const expr = parseExpr('[...arr, 4]');
      expect(expr.kind).toBe('ListExpr');
      if (expr.kind === 'ListExpr') {
        expect(expr.elements[0].spread).toBe(true);
        expect(expr.elements[1].spread).toBeFalsy();
      }
    });

    it('should parse list with trailing comma', () => {
      const expr = parseExpr('[1, 2, 3,]');
      expect(expr.kind).toBe('ListExpr');
      if (expr.kind === 'ListExpr') {
        expect(expr.elements.length).toBe(3);
      }
    });
  });

  describe('tuple expressions', () => {
    it('should parse tuple', () => {
      const expr = parseExpr('(1, 2)');
      expect(expr.kind).toBe('TupleExpr');
      if (expr.kind === 'TupleExpr') {
        expect(expr.elements.length).toBe(2);
      }
    });

    it('should parse tuple with mixed types', () => {
      const expr = parseExpr('(1, "hello", true)');
      expect(expr.kind).toBe('TupleExpr');
      if (expr.kind === 'TupleExpr') {
        expect(expr.elements.length).toBe(3);
      }
    });
  });

  describe('record expressions', () => {
    it('should parse empty record', () => {
      const expr = parseExpr('{}');
      expect(expr.kind).toBe('RecordExpr');
      if (expr.kind === 'RecordExpr') {
        expect(expr.fields.length).toBe(0);
      }
    });

    it('should parse record with fields', () => {
      const expr = parseExpr('{ name: "Max", age: 99 }');
      expect(expr.kind).toBe('RecordExpr');
      if (expr.kind === 'RecordExpr') {
        expect(expr.fields.length).toBe(2);
        const field0 = expr.fields[0];
        if (!field0.spread) {
          expect(field0.key).toBe('name');
        }
      }
    });

    it('should parse record with spread', () => {
      const expr = parseExpr('{ ...base, z: 3 }');
      expect(expr.kind).toBe('RecordExpr');
      if (expr.kind === 'RecordExpr') {
        expect(expr.fields[0].spread).toBe(true);
      }
    });
  });

  describe('member expressions', () => {
    it('should parse member access', () => {
      const expr = parseExpr('user.name');
      expect(expr.kind).toBe('MemberExpr');
      if (expr.kind === 'MemberExpr') {
        expect(expr.member).toBe('name');
      }
    });

    it('should parse chained member access', () => {
      const expr = parseExpr('user.address.city');
      expect(expr.kind).toBe('MemberExpr');
    });
  });

  describe('index expressions', () => {
    it('should parse array index', () => {
      const expr = parseExpr('arr[0]');
      expect(expr.kind).toBe('IndexExpr');
      if (expr.kind === 'IndexExpr') {
        expect(expr.object.kind).toBe('Identifier');
        expect(expr.index.kind).toBe('NumberLiteral');
      }
    });

    it('should parse computed index', () => {
      const expr = parseExpr('arr[i + 1]');
      expect(expr.kind).toBe('IndexExpr');
      if (expr.kind === 'IndexExpr') {
        expect(expr.index.kind).toBe('BinaryExpr');
      }
    });
  });

  describe('ternary expressions', () => {
    it('should parse ternary expression', () => {
      const expr = parseExpr('x > 0 ? "yes" : "no"');
      expect(expr.kind).toBe('TernaryExpr');
      if (expr.kind === 'TernaryExpr') {
        expect(expr.condition.kind).toBe('BinaryExpr');
        expect(expr.thenBranch.kind).toBe('StringLiteral');
        expect(expr.elseBranch.kind).toBe('StringLiteral');
      }
    });
  });

  describe('match expressions', () => {
    it('should parse match with pattern cases', () => {
      const expr = parseExpr('match x\n| 0 -> "zero"\n| 1 -> "one"');
      expect(expr.kind).toBe('MatchExpr');
      if (expr.kind === 'MatchExpr') {
        expect(expr.cases.length).toBe(2);
        expect(expr.cases[0].pattern?.kind).toBe('NumberLiteral');
      }
    });

    it('should parse match with guard', () => {
      const expr = parseExpr('match x\n| if input > 0 -> "positive"');
      expect(expr.kind).toBe('MatchExpr');
      if (expr.kind === 'MatchExpr') {
        expect(expr.cases[0].guard).not.toBeNull();
        expect(expr.cases[0].pattern).toBeNull();
      }
    });

    it('should parse match with default case', () => {
      const expr = parseExpr('match x\n| 0 -> "zero"\n| "default"');
      expect(expr.kind).toBe('MatchExpr');
      if (expr.kind === 'MatchExpr') {
        const lastCase = expr.cases[expr.cases.length - 1];
        expect(lastCase.pattern).toBeNull();
        expect(lastCase.guard).toBeNull();
      }
    });
  });

  describe('pipeline literals', () => {
    it('should parse pipeline literal', () => {
      const expr = parseExpr('/> double /> addOne');
      expect(expr.kind).toBe('PipelineLiteral');
      if (expr.kind === 'PipelineLiteral') {
        expect(expr.stages.length).toBe(2);
      }
    });

    it('should parse pipeline with decorators', () => {
      const expr = parseExpr('/> double /> addOne #debug');
      expect(expr.kind).toBe('PipelineLiteral');
      if (expr.kind === 'PipelineLiteral') {
        expect(expr.decorators.length).toBe(1);
        expect(expr.decorators[0].name).toBe('debug');
      }
    });

    it('should parse bidirectional pipeline', () => {
      const expr = parseExpr('</> double </> addTen');
      expect(expr.kind).toBe('BidirectionalPipelineLiteral');
      if (expr.kind === 'BidirectionalPipelineLiteral') {
        expect(expr.stages.length).toBe(2);
      }
    });

    it('should parse pipeline with input type', () => {
      const expr = parseExpr('/> double /> reverse :: [Int]');
      expect(expr.kind).toBe('PipelineLiteral');
      if (expr.kind === 'PipelineLiteral') {
        expect(expr.typeSignature).toBeDefined();
        expect(expr.typeSignature?.inputType).toEqual({ list: 'Int', optional: false });
        expect(expr.typeSignature?.outputType).toBeUndefined();
      }
    });

    it('should parse pipeline with input and output types', () => {
      const expr = parseExpr('/> double /> reverse :: [Int] /> [Int]');
      expect(expr.kind).toBe('PipelineLiteral');
      if (expr.kind === 'PipelineLiteral') {
        expect(expr.typeSignature).toBeDefined();
        expect(expr.typeSignature?.inputType).toEqual({ list: 'Int', optional: false });
        expect(expr.typeSignature?.outputType).toEqual({ list: 'Int', optional: false });
      }
    });

    it('should parse pipeline with simple input type', () => {
      const expr = parseExpr('/> double :: Int');
      expect(expr.kind).toBe('PipelineLiteral');
      if (expr.kind === 'PipelineLiteral') {
        expect(expr.typeSignature?.inputType).toBe('Int');
      }
    });

    it('should parse pipeline with tuple types', () => {
      const expr = parseExpr('/> swap :: (Int, String) /> (String, Int)');
      expect(expr.kind).toBe('PipelineLiteral');
      if (expr.kind === 'PipelineLiteral') {
        expect(expr.typeSignature?.inputType).toEqual({ tuple: ['Int', 'String'], optional: false });
        expect(expr.typeSignature?.outputType).toEqual({ tuple: ['String', 'Int'], optional: false });
      }
    });

    it('should parse pipeline with type and decorators', () => {
      const expr = parseExpr('/> double :: Int /> Int #log');
      expect(expr.kind).toBe('PipelineLiteral');
      if (expr.kind === 'PipelineLiteral') {
        expect(expr.typeSignature?.inputType).toBe('Int');
        expect(expr.typeSignature?.outputType).toBe('Int');
        expect(expr.decorators.length).toBe(1);
        expect(expr.decorators[0].name).toBe('log');
      }
    });
  });

  describe('await expressions', () => {
    it('should parse await expression', () => {
      const expr = parseExpr('await fetchData()');
      expect(expr.kind).toBe('AwaitExpr');
      if (expr.kind === 'AwaitExpr') {
        expect(expr.operand.kind).toBe('CallExpr');
      }
    });
  });

  describe('return expressions', () => {
    it('should parse return expression', () => {
      const expr = parseExpr('return 42');
      expect(expr.kind).toBe('ReturnExpr');
      if (expr.kind === 'ReturnExpr') {
        expect(expr.value.kind).toBe('NumberLiteral');
      }
    });
  });

  describe('statements', () => {
    describe('let statements', () => {
      it('should parse let statement', () => {
        const stmt = parseStmt('let x = 42');
        expect(stmt.kind).toBe('LetStmt');
        if (stmt.kind === 'LetStmt') {
          expect(stmt.name).toBe('x');
          expect(stmt.mutable).toBe(false);
        }
      });

      it('should parse maybe (mutable) statement', () => {
        const stmt = parseStmt('maybe x = 42');
        expect(stmt.kind).toBe('LetStmt');
        if (stmt.kind === 'LetStmt') {
          expect(stmt.name).toBe('x');
          expect(stmt.mutable).toBe(true);
        }
      });

      it('should parse let with record destructuring', () => {
        const stmt = parseStmt('let { name, age } = user');
        expect(stmt.kind).toBe('LetStmt');
        if (stmt.kind === 'LetStmt') {
          expect(stmt.pattern?.kind).toBe('RecordPattern');
        }
      });

      it('should parse let with tuple destructuring', () => {
        const stmt = parseStmt('let (x, y) = point');
        expect(stmt.kind).toBe('LetStmt');
        if (stmt.kind === 'LetStmt') {
          expect(stmt.pattern?.kind).toBe('TuplePattern');
        }
      });
    });

    describe('and statements', () => {
      it('should parse and statement for overload', () => {
        const program = parse('let add = (a, b) -> a + b :: (Int, Int) :> Int\nand add = (a, b) -> a ++ b :: (String, String) :> String');
        expect(program.statements.length).toBe(2);
        expect(program.statements[1].kind).toBe('AndStmt');
      });

      it('should parse and statement for reverse', () => {
        const program = parse('let double = (x) -> x * 2\nand double = (x) <- x / 2');
        expect(program.statements[1].kind).toBe('AndStmt');
      });
    });

    describe('context statements', () => {
      it('should parse context definition', () => {
        const stmt = parseStmt('context Logger = { log: print }');
        expect(stmt.kind).toBe('ContextDefStmt');
        if (stmt.kind === 'ContextDefStmt') {
          expect(stmt.name).toBe('Logger');
        }
      });

      it('should parse provide statement', () => {
        const stmt = parseStmt('provide Logger { log: (x) -> x }');
        expect(stmt.kind).toBe('ProvideStmt');
        if (stmt.kind === 'ProvideStmt') {
          expect(stmt.contextName).toBe('Logger');
        }
      });
    });

    describe('codeblock statements', () => {
      it('should parse codeblock', () => {
        const program = parse('{-- Section --}\nlet x = 1\n{/--}');
        expect(program.statements[0].kind).toBe('CodeblockStmt');
        if (program.statements[0].kind === 'CodeblockStmt') {
          expect(program.statements[0].label).toBe('Section');
          expect(program.statements[0].statements.length).toBe(1);
        }
      });
    });

    describe('assignment statements', () => {
      it('should parse assignment to mutable variable', () => {
        const program = parse('maybe x = 1\nx = 2');
        expect(program.statements[1].kind).toBe('AssignStmt');
        if (program.statements[1].kind === 'AssignStmt') {
          expect(program.statements[1].name).toBe('x');
        }
      });
    });
  });

  describe('program level', () => {
    it('should parse multiple statements', () => {
      const program = parse('let x = 1\nlet y = 2\nx + y');
      expect(program.statements.length).toBe(3);
    });

    it('should parse #strict pragma', () => {
      const program = parse('#strict\nlet x = 1');
      expect(program.strict).toBe(true);
    });

    it('should set strict to false by default', () => {
      const program = parse('let x = 1');
      expect(program.strict).toBe(false);
    });
  });

  describe('grouping and precedence', () => {
    it('should parse parenthesized expressions', () => {
      const expr = parseExpr('(1 + 2) * 3');
      expect(expr.kind).toBe('BinaryExpr');
      if (expr.kind === 'BinaryExpr') {
        expect(expr.left.kind).toBe('BinaryExpr');
        expect(expr.right.kind).toBe('NumberLiteral');
      }
    });

    it('should parse pipe with higher precedence than arithmetic', () => {
      // a /> b + c should parse as (a /> b) + c
      const expr = parseExpr('1 /> double + 1');
      expect(expr.kind).toBe('BinaryExpr');
      if (expr.kind === 'BinaryExpr') {
        expect(expr.left.kind).toBe('PipeExpr');
      }
    });
  });

  describe('error handling', () => {
    it('should throw on unclosed parenthesis', () => {
      expect(() => parse('(1 + 2')).toThrow(ParseError);
    });

    it('should throw on unclosed bracket', () => {
      expect(() => parse('[1, 2')).toThrow(ParseError);
    });

    it('should throw on unclosed brace', () => {
      expect(() => parse('{ a: 1')).toThrow(ParseError);
    });

    it('should throw on invalid expression', () => {
      expect(() => parse('let = 1')).toThrow(ParseError);
    });
  });
});
