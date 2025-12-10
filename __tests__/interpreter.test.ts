import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import {
  Interpreter,
  LeaValue,
  LeaFunction,
  LeaRecord,
  LeaTuple,
  LeaPipeline,
  RuntimeError,
} from '../src/interpreter';

describe('Interpreter', () => {
  const evaluate = (source: string, strictMode = false): LeaValue => {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();
    const interpreter = new Interpreter(strictMode || program.strict);
    return interpreter.interpret(program);
  };

  const evaluateAsync = async (source: string): Promise<LeaValue> => {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();
    const interpreter = new Interpreter(program.strict);
    return interpreter.interpretAsync(program);
  };

  describe('literals', () => {
    it('should evaluate number literals', () => {
      expect(evaluate('42')).toBe(42);
      expect(evaluate('3.14')).toBe(3.14);
    });

    it('should evaluate string literals', () => {
      expect(evaluate('"hello"')).toBe('hello');
    });

    it('should evaluate boolean literals', () => {
      expect(evaluate('true')).toBe(true);
      expect(evaluate('false')).toBe(false);
    });

    it('should evaluate template strings', () => {
      expect(evaluate('let x = "world"\n`hello {x}`')).toBe('hello world');
      expect(evaluate('`sum: {1 + 2}`')).toBe('sum: 3');
    });
  });

  describe('arithmetic operations', () => {
    it('should evaluate addition', () => {
      expect(evaluate('1 + 2')).toBe(3);
    });

    it('should evaluate subtraction', () => {
      expect(evaluate('5 - 3')).toBe(2);
    });

    it('should evaluate multiplication', () => {
      expect(evaluate('4 * 3')).toBe(12);
    });

    it('should evaluate division', () => {
      expect(evaluate('10 / 2')).toBe(5);
    });

    it('should evaluate modulo', () => {
      expect(evaluate('7 % 3')).toBe(1);
    });

    it('should respect operator precedence', () => {
      expect(evaluate('2 + 3 * 4')).toBe(14);
      expect(evaluate('(2 + 3) * 4')).toBe(20);
    });

    it('should evaluate negative numbers', () => {
      expect(evaluate('-5')).toBe(-5);
      expect(evaluate('3 + -2')).toBe(1);
    });
  });

  describe('string operations', () => {
    it('should concatenate strings', () => {
      expect(evaluate('"hello" ++ " world"')).toBe('hello world');
    });

    it('should coerce numbers to strings in concatenation', () => {
      expect(evaluate('"value: " ++ 42')).toBe('value: 42');
      expect(evaluate('100 ++ 200')).toBe('100200');
    });

    it('should coerce booleans to strings in concatenation', () => {
      expect(evaluate('"result: " ++ true')).toBe('result: true');
    });
  });

  describe('comparison operations', () => {
    it('should evaluate equality', () => {
      expect(evaluate('1 == 1')).toBe(true);
      expect(evaluate('1 == 2')).toBe(false);
      expect(evaluate('"a" == "a"')).toBe(true);
    });

    it('should evaluate inequality', () => {
      expect(evaluate('1 != 2')).toBe(true);
      expect(evaluate('1 != 1')).toBe(false);
    });

    it('should evaluate less than', () => {
      expect(evaluate('1 < 2')).toBe(true);
      expect(evaluate('2 < 1')).toBe(false);
    });

    it('should evaluate greater than', () => {
      expect(evaluate('2 > 1')).toBe(true);
      expect(evaluate('1 > 2')).toBe(false);
    });

    it('should evaluate less than or equal', () => {
      expect(evaluate('1 <= 1')).toBe(true);
      expect(evaluate('1 <= 2')).toBe(true);
      expect(evaluate('2 <= 1')).toBe(false);
    });

    it('should evaluate greater than or equal', () => {
      expect(evaluate('1 >= 1')).toBe(true);
      expect(evaluate('2 >= 1')).toBe(true);
      expect(evaluate('1 >= 2')).toBe(false);
    });

    it('should compare arrays element by element', () => {
      expect(evaluate('[1, 2] == [1, 2]')).toBe(true);
      expect(evaluate('[1, 2] == [1, 3]')).toBe(false);
      expect(evaluate('[1, 2] == [1, 2, 3]')).toBe(false);
    });
  });

  describe('variables', () => {
    it('should define and read variables', () => {
      expect(evaluate('let x = 10\nx')).toBe(10);
    });

    it('should allow mutable variables', () => {
      expect(evaluate('maybe x = 1\nx = 2\nx')).toBe(2);
    });

    it('should support shadowing', () => {
      expect(evaluate('let x = 1\nlet x = 2\nx')).toBe(2);
    });
  });

  describe('lists', () => {
    it('should create lists', () => {
      const result = evaluate('[1, 2, 3]') as number[];
      expect(result).toEqual([1, 2, 3]);
    });

    it('should access list elements', () => {
      expect(evaluate('[10, 20, 30][1]')).toBe(20);
    });

    it('should handle spread in lists', () => {
      const result = evaluate('let a = [1, 2]\n[...a, 3, 4]') as number[];
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should handle empty lists', () => {
      const result = evaluate('[]') as any[];
      expect(result).toEqual([]);
    });
  });

  describe('tuples', () => {
    it('should create tuples', () => {
      const result = evaluate('(1, 2)') as LeaTuple;
      expect(result.kind).toBe('tuple');
      expect(result.elements).toEqual([1, 2]);
    });

    it('should allow mixed types in tuples', () => {
      const result = evaluate('(1, "hello", true)') as LeaTuple;
      expect(result.elements).toEqual([1, 'hello', true]);
    });
  });

  describe('records', () => {
    it('should create records', () => {
      const result = evaluate('{ name: "Max", age: 99 }') as LeaRecord;
      expect(result.kind).toBe('record');
      expect(result.fields.get('name')).toBe('Max');
      expect(result.fields.get('age')).toBe(99);
    });

    it('should access record fields', () => {
      expect(evaluate('let r = { x: 10 }\nr.x')).toBe(10);
    });

    it('should handle spread in records', () => {
      const result = evaluate('let base = { x: 1 }\n{ ...base, y: 2 }') as LeaRecord;
      expect(result.fields.get('x')).toBe(1);
      expect(result.fields.get('y')).toBe(2);
    });

    it('should override with spread', () => {
      const result = evaluate('let base = { x: 1 }\n{ ...base, x: 2 }') as LeaRecord;
      expect(result.fields.get('x')).toBe(2);
    });
  });

  describe('destructuring', () => {
    it('should destructure records', () => {
      expect(evaluate('let user = { name: "Alice", age: 30 }\nlet { name, age } = user\nname')).toBe('Alice');
    });

    it('should destructure tuples', () => {
      expect(evaluate('let point = (10, 20)\nlet (x, y) = point\nx')).toBe(10);
    });

    it('should destructure lists', () => {
      expect(evaluate('let arr = [1, 2, 3]\nlet (a, b) = arr\na + b')).toBe(3);
    });
  });

  describe('functions', () => {
    it('should define and call functions', () => {
      expect(evaluate('let double = (x) -> x * 2\ndouble(5)')).toBe(10);
    });

    it('should support multiple parameters', () => {
      expect(evaluate('let add = (a, b) -> a + b\nadd(3, 4)')).toBe(7);
    });

    it('should support default parameters', () => {
      expect(evaluate('let greet = (x, y = "Hello") -> y ++ " " ++ x\ngreet("World")')).toBe('Hello World');
    });

    it('should capture closure', () => {
      expect(evaluate('let x = 10\nlet add = (y) -> x + y\nadd(5)')).toBe(15);
    });

    it('should support ignored parameters', () => {
      expect(evaluate('let first = (x, _) -> x\nfirst(1, 2)')).toBe(1);
    });

    it('should support multi-statement bodies', () => {
      expect(evaluate(`
        let process = (x) ->
          let y = x * 2
          let z = y + 1
          z
        process(5)
      `)).toBe(11);
    });

    it('should support early return', () => {
      expect(evaluate(`
        let clamp = (x) ->
          x > 100 ? return 100 : 0
          x
        clamp(200)
      `)).toBe(100);
    });
  });

  describe('pipes', () => {
    it('should pipe value to function', () => {
      expect(evaluate('let double = (x) -> x * 2\n5 /> double')).toBe(10);
    });

    it('should chain pipes', () => {
      expect(evaluate('let double = (x) -> x * 2\nlet addOne = (x) -> x + 1\n5 /> double /> addOne')).toBe(11);
    });

    it('should support placeholder in pipe', () => {
      expect(evaluate('let add = (a, b) -> a + b\n5 /> add(3, input)')).toBe(8);
    });

    it('should prepend piped value when no placeholder', () => {
      expect(evaluate('let add = (a, b) -> a + b\n5 /> add(3)')).toBe(8);
    });

    it('should handle spread pipe', () => {
      const result = evaluate('let double = (x) -> x * 2\n[1, 2, 3] />>> double') as number[];
      expect(result).toEqual([2, 4, 6]);
    });

    it('should pass index to spread pipe callback', () => {
      const result = evaluate('[10, 20, 30] />>> (x, i) -> x + i') as number[];
      expect(result).toEqual([10, 21, 32]);
    });
  });

  describe('pipelines', () => {
    it('should create and apply pipeline', () => {
      expect(evaluate('let double = (x) -> x * 2\nlet addOne = (x) -> x + 1\nlet p = /> double /> addOne\n5 /> p')).toBe(11);
    });

    it('should get pipeline length', () => {
      expect(evaluate('let double = (x) -> x * 2\nlet p = /> double /> double\np.length')).toBe(2);
    });

    it('should compose pipelines', () => {
      expect(evaluate(`
        let double = (x) -> x * 2
        let addOne = (x) -> x + 1
        let p1 = /> double
        let p2 = /> addOne
        let combined = /> p1 /> p2
        5 /> combined
      `)).toBe(11);
    });

    it('should parse pipeline with input type only', () => {
      const result = evaluate(`
        let double = (x) -> x * 2
        let p = /> map(double) :: [Int]
        [1, 2, 3] /> p
      `);
      expect(result).toEqual([2, 4, 6]);
    });

    it('should parse pipeline with input and output types', () => {
      const result = evaluate(`
        let double = (x) -> x * 2
        let p = /> map(double) :: [Int] /> [Int]
        [1, 2, 3] /> p
      `);
      expect(result).toEqual([2, 4, 6]);
    });

    it('should validate pipeline input type in strict mode', () => {
      expect(() => evaluate(`
        #strict
        let double = (x) -> x * 2
        let p = /> map(double) :: [Int]
        "not a list" /> p
      `)).toThrow(/expected input type/i);
    });

    it('should validate pipeline output type in strict mode', () => {
      expect(() => evaluate(`
        #strict
        let toStr = (x) -> toString(x)
        let p = /> map(toStr) :: [Int] /> [Int]
        [1, 2, 3] /> p
      `)).toThrow(/expected output type/i);
    });

    it('should pass validation with correct types in strict mode', () => {
      const result = evaluate(`
        #strict
        let double = (x) -> x * 2
        let p = /> map(double) :: [Int] /> [Int]
        [1, 2, 3] /> p
      `);
      expect(result).toEqual([2, 4, 6]);
    });

    it('should handle spread pipe in pipeline literal', () => {
      const result = evaluate(`
        let double = (x) -> x * 2
        let p = /> filter((x) -> x > 2) />>> double
        [1, 2, 3, 4, 5] /> p
      `);
      expect(result).toEqual([6, 8, 10]);
    });

    it('should handle spread pipe followed by regular stage in pipeline literal', () => {
      const result = evaluate(`
        let p = /> filter((x) -> x > 2) />>> (x) -> x * x /> reduce(0, (acc, x) -> acc + x)
        [1, 2, 3, 4, 5] /> p
      `);
      expect(result).toBe(50); // 9 + 16 + 25
    });

    it('should pass index to spread pipe callback in pipeline literal', () => {
      const result = evaluate(`
        let addIndex = (x, i) -> x + i
        let identity = (x) -> x
        let p = /> identity />>> addIndex
        [10, 20, 30] /> p
      `);
      expect(result).toEqual([10, 21, 32]);
    });

    it('should handle multiple spread pipes in pipeline literal', () => {
      const result = evaluate(`
        let identity = (x) -> x
        let double = (x) -> x * 2
        let addOne = (x) -> x + 1
        let p = /> identity />>> double />>> addOne
        [1, 2, 3] /> p
      `);
      expect(result).toEqual([3, 5, 7]); // [2, 4, 6] -> [3, 5, 7]
    });

    it('should handle parallel followed by spread in pipeline literal', () => {
      const result = evaluate(`
        let double = (x) -> x * 2
        let addOne = (x) -> x + 1
        let square = (x) -> x * x
        let addHundred = (x) -> x + 100
        let p = /> double \\> addOne \\> square />>> addHundred
        5 /> p
      `);
      // 5 /> double = 10
      // 10 \> addOne \> square = parallel with 2 branches = [11, 100]
      // [11, 100] />>> addHundred = [111, 200]
      expect(result).toEqual([111, 200]);
    });

    it('should handle pipeline starting with spread', () => {
      const result = evaluate(`
        let double = (x) -> x * 2
        let sum = (list) -> reduce(list, 0, (acc, x) -> acc + x)
        let p = />>> double /> sum
        [1, 2, 3] /> p
      `);
      // [1, 2, 3] />>> double = [2, 4, 6]
      // [2, 4, 6] /> sum = 12
      expect(result).toBe(12);
    });

    it('should handle pipeline starting with spread only', () => {
      const result = evaluate(`
        let double = (x) -> x * 2
        let p = />>> double
        [1, 2, 3] /> p
      `);
      expect(result).toEqual([2, 4, 6]);
    });
  });

  describe('reversible functions', () => {
    it('should apply forward function', () => {
      expect(evaluate(`
        let double = (x) -> x * 2
        and double = (x) <- x / 2
        5 /> double
      `)).toBe(10);
    });

    it('should apply reverse function', () => {
      expect(evaluate(`
        let double = (x) -> x * 2
        and double = (x) <- x / 2
        10 </ double
      `)).toBe(5);
    });

    it('should roundtrip preserve value', () => {
      expect(evaluate(`
        let double = (x) -> x * 2
        and double = (x) <- x / 2
        5 /> double </ double
      `)).toBe(5);
    });
  });

  describe('ternary expressions', () => {
    it('should evaluate then branch when true', () => {
      expect(evaluate('true ? "yes" : "no"')).toBe('yes');
    });

    it('should evaluate else branch when false', () => {
      expect(evaluate('false ? "yes" : "no"')).toBe('no');
    });

    it('should evaluate condition', () => {
      expect(evaluate('5 > 3 ? "bigger" : "smaller"')).toBe('bigger');
    });
  });

  describe('match expressions', () => {
    it('should match literal patterns', () => {
      expect(evaluate(`
        let describe = (x) -> match x
          | 0 -> "zero"
          | 1 -> "one"
          | "default"
        describe(0)
      `)).toBe('zero');
    });

    it('should match with guards', () => {
      expect(evaluate(`
        let describe = (x) -> match x
          | if input < 0 -> "negative"
          | if input > 0 -> "positive"
          | "zero"
        describe(-5)
      `)).toBe('negative');
    });

    it('should use input in guard body', () => {
      expect(evaluate(`
        let process = (x) -> match x
          | if input > 0 -> input * 2
          | 0
        process(5)
      `)).toBe(10);
    });

    it('should fall through to default', () => {
      expect(evaluate(`
        let describe = (x) -> match x
          | 0 -> "zero"
          | "other"
        describe(99)
      `)).toBe('other');
    });
  });

  describe('function overloading', () => {
    it('should resolve overload by type', () => {
      expect(evaluate(`
        let add = (a, b) -> a + b :: (Int, Int) :> Int
        and add = (a, b) -> a ++ b :: (String, String) :> String
        add(1, 2)
      `)).toBe(3);

      expect(evaluate(`
        let add = (a, b) -> a + b :: (Int, Int) :> Int
        and add = (a, b) -> a ++ b :: (String, String) :> String
        add("a", "b")
      `)).toBe('ab');
    });

    it('should resolve overload by arity', () => {
      expect(evaluate(`
        let foo = (x) -> x * 2 :: Int :> Int
        and foo = (x, y) -> x + y :: (Int, Int) :> Int
        foo(5)
      `)).toBe(10);

      expect(evaluate(`
        let foo = (x) -> x * 2 :: Int :> Int
        and foo = (x, y) -> x + y :: (Int, Int) :> Int
        foo(3, 4)
      `)).toBe(7);
    });
  });

  describe('context system', () => {
    it('should define and use context', () => {
      expect(evaluate(`
        context Config = { value: 10 }
        let getValue = () ->
          @Config
          Config.value
        getValue()
      `)).toBe(10);
    });

    it('should override context with provide', () => {
      expect(evaluate(`
        context Config = { value: 10 }
        provide Config { value: 20 }
        let getValue = () ->
          @Config
          Config.value
        getValue()
      `)).toBe(20);
    });
  });

  describe('builtins', () => {
    describe('math', () => {
      it('should compute sqrt', () => {
        expect(evaluate('16 /> sqrt')).toBe(4);
      });

      it('should compute abs', () => {
        expect(evaluate('-5 /> abs')).toBe(5);
      });

      it('should compute floor', () => {
        expect(evaluate('3.7 /> floor')).toBe(3);
      });

      it('should compute ceil', () => {
        expect(evaluate('3.2 /> ceil')).toBe(4);
      });

      it('should compute round', () => {
        expect(evaluate('3.5 /> round')).toBe(4);
      });

      it('should compute min/max', () => {
        expect(evaluate('min(3, 5)')).toBe(3);
        expect(evaluate('max(3, 5)')).toBe(5);
      });
    });

    describe('list operations', () => {
      it('should get length', () => {
        expect(evaluate('[1, 2, 3] /> length')).toBe(3);
      });

      it('should get head', () => {
        expect(evaluate('[1, 2, 3] /> head')).toBe(1);
      });

      it('should get tail', () => {
        expect(evaluate('[1, 2, 3] /> tail')).toEqual([2, 3]);
      });

      it('should map', () => {
        expect(evaluate('[1, 2, 3] /> map((x) -> x * 2)')).toEqual([2, 4, 6]);
      });

      it('should map with index', () => {
        expect(evaluate('[10, 20, 30] /> map((x, i) -> x + i)')).toEqual([10, 21, 32]);
      });

      it('should filter', () => {
        expect(evaluate('[1, 2, 3, 4] /> filter((x) -> x > 2)')).toEqual([3, 4]);
      });

      it('should filter with index', () => {
        expect(evaluate('[10, 20, 30, 40] /> filter((_, i) -> i < 2)')).toEqual([10, 20]);
      });

      it('should reduce', () => {
        expect(evaluate('[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)')).toBe(6);
      });

      it('should reduce with index', () => {
        expect(evaluate('[10, 20, 30] /> reduce(0, (acc, _, i) -> acc + i)')).toBe(3);
      });

      it('should concat lists', () => {
        expect(evaluate('concat([1, 2], [3, 4])')).toEqual([1, 2, 3, 4]);
      });

      it('should reverse list', () => {
        expect(evaluate('[1, 2, 3] /> reverse')).toEqual([3, 2, 1]);
      });

      it('should check isEmpty', () => {
        expect(evaluate('[] /> isEmpty')).toBe(true);
        expect(evaluate('[1] /> isEmpty')).toBe(false);
      });

      it('should push to list', () => {
        expect(evaluate('push([1, 2], 3)')).toEqual([1, 2, 3]);
      });

      it('should take from list', () => {
        expect(evaluate('take([1, 2, 3, 4], 2)')).toEqual([1, 2]);
      });

      it('should get element at index', () => {
        expect(evaluate('at([10, 20, 30], 1)')).toBe(20);
      });

      it('should get fst and snd', () => {
        expect(evaluate('fst([1, 2, 3])')).toBe(1);
        expect(evaluate('snd([1, 2, 3])')).toBe(2);
      });

      it('should zip lists', () => {
        // zip takes a list of lists and zips them together
        expect(evaluate('zip([[1, 2], ["a", "b"]])')).toEqual([[1, 'a'], [2, 'b']]);
      });

      it('should create range', () => {
        expect(evaluate('range(1, 4)')).toEqual([1, 2, 3]);
      });
    });

    describe('string operations', () => {
      it('should get string length', () => {
        expect(evaluate('"hello" /> length')).toBe(5);
      });

      it('should split string', () => {
        expect(evaluate('split("a,b,c", ",")')).toEqual(['a', 'b', 'c']);
      });

      it('should split by lines', () => {
        // Use template literal with actual newlines
        expect(evaluate('lines("a\nb\nc")')).toEqual(['a', 'b', 'c']);
      });

      it('should join list', () => {
        expect(evaluate('join(["a", "b", "c"], "-")')).toBe('a-b-c');
      });

      it('should get charAt', () => {
        expect(evaluate('charAt("hello", 1)')).toBe('e');
      });

      it('should trim string', () => {
        expect(evaluate('trim("  hello  ")')).toBe('hello');
      });

      it('should indexOf', () => {
        expect(evaluate('indexOf("hello", "ll")')).toBe(2);
      });

      it('should includes', () => {
        expect(evaluate('includes("hello", "ell")')).toBe(true);
        expect(evaluate('includes("hello", "xyz")')).toBe(false);
      });

      it('should repeat string', () => {
        expect(evaluate('repeat("ab", 3)')).toBe('ababab');
      });

      it('should slice string', () => {
        expect(evaluate('slice("hello", 1, 4)')).toBe('ell');
      });

      it('should toString', () => {
        expect(evaluate('toString(42)')).toBe('42');
        expect(evaluate('toString([1, 2])')).toBe('[1, 2]');
      });
    });

    describe('set operations', () => {
      it('should create set from list', () => {
        expect(evaluate('listSet([1, 2, 2, 3, 3, 3])')).toEqual([1, 2, 3]);
      });

      it('should add to set', () => {
        expect(evaluate('setAdd([1, 2], 3)')).toEqual([1, 2, 3]);
        expect(evaluate('setAdd([1, 2], 2)')).toEqual([1, 2]);
      });

      it('should check set membership', () => {
        expect(evaluate('setHas([1, 2, 3], 2)')).toBe(true);
        expect(evaluate('setHas([1, 2, 3], 4)')).toBe(false);
      });
    });

    describe('new collection operations', () => {
      it('should find element matching predicate', () => {
        expect(evaluate('[1, 2, 3, 4] /> find((x) -> x > 2)')).toBe(3);
        expect(evaluate('[1, 2, 3] /> find((x) -> x > 10)')).toBe(null);
      });

      it('should findIndex of element matching predicate', () => {
        expect(evaluate('[1, 2, 3, 4] /> findIndex((x) -> x > 2)')).toBe(2);
        expect(evaluate('[1, 2, 3] /> findIndex((x) -> x > 10)')).toBe(-1);
      });

      it('should check if some elements match', () => {
        expect(evaluate('[1, 2, 3] /> some((x) -> x > 2)')).toBe(true);
        expect(evaluate('[1, 2, 3] /> some((x) -> x > 10)')).toBe(false);
      });

      it('should check if every element matches', () => {
        expect(evaluate('[2, 4, 6] /> every((x) -> x > 0)')).toBe(true);
        expect(evaluate('[2, 4, 6] /> every((x) -> x > 3)')).toBe(false);
      });

      it('should sort list', () => {
        expect(evaluate('[3, 1, 4, 1, 5] /> sort')).toEqual([1, 1, 3, 4, 5]);
        expect(evaluate('["b", "a", "c"] /> sort')).toEqual(['a', 'b', 'c']);
      });

      it('should sort with custom comparator', () => {
        expect(evaluate('[3, 1, 4] /> sort((a, b) -> b - a)')).toEqual([4, 3, 1]);
      });

      it('should flatten nested lists', () => {
        expect(evaluate('[[1, 2], [3, 4]] /> flatten')).toEqual([1, 2, 3, 4]);
        expect(evaluate('[[[1]], [[2]]] /> flatten(2)')).toEqual([1, 2]);
      });

      it('should flatMap list', () => {
        expect(evaluate('[1, 2, 3] /> flatMap((x) -> [x, x * 2])')).toEqual([1, 2, 2, 4, 3, 6]);
      });

      it('should get last element', () => {
        expect(evaluate('[1, 2, 3] /> last')).toBe(3);
      });

      it('should drop elements', () => {
        expect(evaluate('[1, 2, 3, 4] /> drop(2)')).toEqual([3, 4]);
      });

      it('should takeWhile predicate is true', () => {
        expect(evaluate('[1, 2, 3, 4, 1] /> takeWhile((x) -> x < 4)')).toEqual([1, 2, 3]);
      });

      it('should dropWhile predicate is true', () => {
        expect(evaluate('[1, 2, 3, 4, 1] /> dropWhile((x) -> x < 3)')).toEqual([3, 4, 1]);
      });

      it('should count elements', () => {
        expect(evaluate('[1, 2, 3, 4] /> count')).toBe(4);
        expect(evaluate('[1, 2, 3, 4] /> count((x) -> x > 2)')).toBe(2);
      });

      it('should intersperse separator', () => {
        expect(evaluate('[1, 2, 3] /> intersperse(0)')).toEqual([1, 0, 2, 0, 3]);
      });

      it('should enumerate list', () => {
        expect(evaluate('["a", "b"] /> enumerate')).toEqual([[0, 'a'], [1, 'b']]);
        expect(evaluate('["a", "b"] /> enumerate(1)')).toEqual([[1, 'a'], [2, 'b']]);
      });

      it('should transpose matrix', () => {
        expect(evaluate('[[1, 2], [3, 4]] /> transpose')).toEqual([[1, 3], [2, 4]]);
      });
    });

    describe('bitwise operations', () => {
      it('should compute bitAnd', () => {
        expect(evaluate('bitAnd(5, 3)')).toBe(1);
      });

      it('should compute bitOr', () => {
        expect(evaluate('bitOr(5, 3)')).toBe(7);
      });

      it('should compute bitXor', () => {
        expect(evaluate('bitXor(5, 3)')).toBe(6);
      });

      it('should compute bitNot', () => {
        expect(evaluate('bitNot(5)')).toBe(-6);
      });

      it('should compute bitShiftLeft', () => {
        expect(evaluate('bitShiftLeft(1, 3)')).toBe(8);
      });

      it('should compute bitShiftRight', () => {
        expect(evaluate('bitShiftRight(8, 2)')).toBe(2);
      });
    });

    describe('statistics operations', () => {
      it('should compute sum', () => {
        expect(evaluate('[1, 2, 3, 4] /> sum')).toBe(10);
      });

      it('should compute product', () => {
        expect(evaluate('[1, 2, 3, 4] /> product')).toBe(24);
      });

      it('should compute mean', () => {
        expect(evaluate('[1, 2, 3, 4, 5] /> mean')).toBe(3);
      });

      it('should compute median', () => {
        expect(evaluate('[1, 3, 5, 7, 9] /> median')).toBe(5);
        expect(evaluate('[1, 2, 3, 4] /> median')).toBe(2.5);
      });

      it('should compute variance', () => {
        expect(evaluate('[2, 4, 4, 4, 5, 5, 7, 9] /> variance')).toBe(4);
      });

      it('should compute stdDev', () => {
        expect(evaluate('[2, 4, 4, 4, 5, 5, 7, 9] /> stdDev')).toBe(2);
      });
    });

    describe('number theory operations', () => {
      it('should compute gcd', () => {
        expect(evaluate('gcd(48, 18)')).toBe(6);
      });

      it('should compute lcm', () => {
        expect(evaluate('lcm(4, 6)')).toBe(12);
      });

      it('should check isPrime', () => {
        expect(evaluate('isPrime(7)')).toBe(true);
        expect(evaluate('isPrime(6)')).toBe(false);
      });

      it('should compute factorial', () => {
        expect(evaluate('factorial(5)')).toBe(120);
      });

      it('should compute fibonacci', () => {
        expect(evaluate('fibonacci(10)')).toBe(55);
      });

      it('should check isEven and isOdd', () => {
        expect(evaluate('isEven(4)')).toBe(true);
        expect(evaluate('isOdd(4)')).toBe(false);
        expect(evaluate('isEven(3)')).toBe(false);
        expect(evaluate('isOdd(3)')).toBe(true);
      });

      it('should compute mod (handles negatives correctly)', () => {
        expect(evaluate('mod(-5, 3)')).toBe(1);
        expect(evaluate('mod(5, 3)')).toBe(2);
      });

      it('should compute divInt', () => {
        expect(evaluate('divInt(7, 3)')).toBe(2);
        expect(evaluate('divInt(-7, 3)')).toBe(-2);
      });
    });

    describe('regex operations', () => {
      it('should test regex pattern', () => {
        expect(evaluate('regexTest("hello123", "[0-9]+")')).toBe(true);
        expect(evaluate('regexTest("hello", "[0-9]+")')).toBe(false);
      });

      it('should match regex pattern', () => {
        const result = evaluate('regexMatch("hello123world", "[0-9]+")') as LeaRecord;
        expect(result.fields.get('match')).toBe('123');
        expect(result.fields.get('index')).toBe(5);
      });

      it('should matchAll regex pattern', () => {
        const result = evaluate('regexMatchAll("a1b2c3", "[0-9]")') as LeaRecord[];
        expect(result.length).toBe(3);
      });

      it('should replace with regex', () => {
        expect(evaluate('regexReplace("hello123world456", "[0-9]+", "X")')).toBe('helloXworldX');
      });

      it('should split by regex', () => {
        expect(evaluate('regexSplit("a1b2c3", "[0-9]")')).toEqual(['a', 'b', 'c', '']);
      });
    });

    describe('case conversion operations', () => {
      it('should convert to camelCase', () => {
        expect(evaluate('toCamelCase("hello_world")')).toBe('helloWorld');
        expect(evaluate('toCamelCase("hello-world")')).toBe('helloWorld');
      });

      it('should convert to PascalCase', () => {
        expect(evaluate('toPascalCase("hello_world")')).toBe('HelloWorld');
      });

      it('should convert to snake_case', () => {
        expect(evaluate('toSnakeCase("helloWorld")')).toBe('hello_world');
        expect(evaluate('toSnakeCase("HelloWorld")')).toBe('hello_world');
      });

      it('should convert to kebab-case', () => {
        expect(evaluate('toKebabCase("helloWorld")')).toBe('hello-world');
      });

      it('should convert to CONSTANT_CASE', () => {
        expect(evaluate('toConstantCase("helloWorld")')).toBe('HELLO_WORLD');
      });

      it('should capitalize', () => {
        expect(evaluate('capitalize("hello")')).toBe('Hello');
      });

      it('should titleCase', () => {
        expect(evaluate('titleCase("hello world")')).toBe('Hello World');
      });
    });

    describe('encoding operations', () => {
      it('should base64 encode and decode', () => {
        expect(evaluate('base64Encode("hello")')).toBe('aGVsbG8=');
        expect(evaluate('base64Decode("aGVsbG8=")')).toBe('hello');
      });

      it('should url encode and decode', () => {
        expect(evaluate('urlEncode("hello world")')).toBe('hello%20world');
        expect(evaluate('urlDecode("hello%20world")')).toBe('hello world');
      });

      it('should hex encode and decode', () => {
        expect(evaluate('hexEncode("AB")')).toBe('4142');
        expect(evaluate('hexDecode("4142")')).toBe('AB');
      });
    });

    describe('path utilities', () => {
      it('should join paths', () => {
        expect(evaluate('pathJoin("foo", "bar", "baz")')).toBe('foo/bar/baz');
      });

      it('should get dirname', () => {
        expect(evaluate('pathDirname("/foo/bar/baz.txt")')).toBe('/foo/bar');
      });

      it('should get basename', () => {
        expect(evaluate('pathBasename("/foo/bar/baz.txt")')).toBe('baz.txt');
        expect(evaluate('pathBasename("/foo/bar/baz.txt", ".txt")')).toBe('baz');
      });

      it('should get extname', () => {
        expect(evaluate('pathExtname("/foo/bar/baz.txt")')).toBe('.txt');
      });

      it('should check isAbsolute', () => {
        expect(evaluate('pathIsAbsolute("/foo/bar")')).toBe(true);
        expect(evaluate('pathIsAbsolute("foo/bar")')).toBe(false);
      });
    });

    describe('environment utilities', () => {
      it('should get cwd', () => {
        const result = evaluate('cwd()');
        expect(typeof result).toBe('string');
        expect((result as string).length).toBeGreaterThan(0);
      });

      it('should get platform', () => {
        const result = evaluate('platform()');
        expect(['linux', 'darwin', 'win32']).toContain(result);
      });
    });
  });

  describe('decorators', () => {
    it('should apply #log decorator without error', () => {
      // Just verify decorated functions work
      expect(evaluate(`
        let double = (x) -> x * 2 #log
        double(5)
      `)).toBe(10);
    });

    it('should apply #time decorator without error', () => {
      expect(evaluate(`
        let slow = (x) -> x * 2 #time
        slow(5)
      `)).toBe(10);
    });

    it('should apply #memo decorator', () => {
      // Memo caches results based on arguments
      expect(evaluate(`
        let expensive = (x) -> x * x #memo
        expensive(5) + expensive(5)
      `)).toBe(50);
    });
  });

  describe('async operations', () => {
    it('should handle delay', async () => {
      const result = await evaluateAsync('await delay(10, 42)');
      expect(result).toBe(42);
    });

    it('should chain promises in pipes', async () => {
      const result = await evaluateAsync(`
        let double = (x) -> x * 2
        await delay(10, 5) /> double
      `);
      expect(result).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should throw on undefined variable', () => {
      expect(() => evaluate('undefined_var')).toThrow(RuntimeError);
    });

    it('should throw on non-function call', () => {
      expect(() => evaluate('let x = 5\nx()')).toThrow(RuntimeError);
    });

    it('should throw on record field not found', () => {
      expect(() => evaluate('let r = { a: 1 }\nr.b')).toThrow(RuntimeError);
    });

    it('should throw on spread pipe with non-list', () => {
      expect(() => evaluate('5 />>> print')).toThrow(RuntimeError);
    });

    it('should throw on match with no matching case', () => {
      expect(() => evaluate(`
        let f = (x) -> match x
          | 0 -> "zero"
        f(5)
      `)).toThrow(RuntimeError);
    });
  });

  describe('strict mode', () => {
    it('should validate types in strict mode', () => {
      expect(() => evaluate(`
        #strict
        let double = (x) -> x * 2 :: Int :> Int
        double("not a number")
      `)).toThrow(RuntimeError);
    });

    it('should pass with correct types in strict mode', () => {
      expect(evaluate(`
        #strict
        let double = (x) -> x * 2 :: Int :> Int
        double(5)
      `)).toBe(10);
    });
  });

  describe('RuntimeError with source location', () => {
    it('should create RuntimeError with location info', () => {
      const { RuntimeError, SourceLocation } = require('../src/interpreter');
      const location: typeof SourceLocation = { line: 10, column: 5, file: 'test.lea' };
      const error = new RuntimeError('Test error', location);
      expect(error.message).toContain('[test.lea:10:5]');
      expect(error.message).toContain('Test error');
      expect(error.location).toEqual(location);
    });

    it('should create RuntimeError without location', () => {
      const { RuntimeError } = require('../src/interpreter');
      const error = new RuntimeError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.location).toBeUndefined();
    });

    it('should create RuntimeError with location but no file', () => {
      const { RuntimeError } = require('../src/interpreter');
      const location = { line: 5, column: 3 };
      const error = new RuntimeError('Test error', location);
      expect(error.message).toContain('[5:3]');
      expect(error.message).toContain('Test error');
    });
  });
});
