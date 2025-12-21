import { LexerError } from '../src/lexer';
import { TokenType } from '../src/token';
import { tokenize, getTokenTypes } from './helpers';

describe('Lexer', () => {

  describe('literals', () => {
    it('should tokenize integers', () => {
      const tokens = tokenize('42');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].literal).toBe(42);
    });

    it('should tokenize floats', () => {
      const tokens = tokenize('3.14');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].literal).toBe(3.14);
    });

    it('should tokenize strings', () => {
      const tokens = tokenize('"hello world"');
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].literal).toBe('hello world');
    });

    it('should tokenize empty strings', () => {
      const tokens = tokenize('""');
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].literal).toBe('');
    });

    it('should tokenize template strings', () => {
      const tokens = tokenize('`hello {name}`');
      expect(tokens[0].type).toBe(TokenType.TEMPLATE_STRING);
      expect(tokens[0].literal).toEqual(['hello ', 'name', '']);
    });

    it('should tokenize template strings with multiple interpolations', () => {
      const tokens = tokenize('`{a} and {b}`');
      expect(tokens[0].type).toBe(TokenType.TEMPLATE_STRING);
      expect(tokens[0].literal).toEqual(['', 'a', ' and ', 'b', '']);
    });

    it('should tokenize booleans', () => {
      expect(tokenize('true')[0].type).toBe(TokenType.TRUE);
      expect(tokenize('false')[0].type).toBe(TokenType.FALSE);
    });
  });

  describe('identifiers and keywords', () => {
    it('should tokenize identifiers', () => {
      const tokens = tokenize('foo bar baz');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].lexeme).toBe('foo');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].lexeme).toBe('bar');
    });

    it('should tokenize identifiers with underscores', () => {
      const tokens = tokenize('my_var _private');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].lexeme).toBe('my_var');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].lexeme).toBe('_private');
    });

    it('should tokenize keywords', () => {
      expect(tokenize('let')[0].type).toBe(TokenType.LET);
      expect(tokenize('and')[0].type).toBe(TokenType.AND);
      expect(tokenize('maybe')[0].type).toBe(TokenType.MAYBE);
      expect(tokenize('await')[0].type).toBe(TokenType.AWAIT);
      expect(tokenize('context')[0].type).toBe(TokenType.CONTEXT);
      expect(tokenize('provide')[0].type).toBe(TokenType.PROVIDE);
      expect(tokenize('match')[0].type).toBe(TokenType.MATCH);
      expect(tokenize('if')[0].type).toBe(TokenType.IF);
      expect(tokenize('return')[0].type).toBe(TokenType.RETURN);
      expect(tokenize('input')[0].type).toBe(TokenType.INPUT);
    });

    it('should distinguish underscore from identifier starting with underscore', () => {
      expect(tokenize('_')[0].type).toBe(TokenType.UNDERSCORE);
      expect(tokenize('_foo')[0].type).toBe(TokenType.IDENTIFIER);
    });
  });

  describe('operators', () => {
    it('should tokenize arithmetic operators', () => {
      expect(tokenize('+')[0].type).toBe(TokenType.PLUS);
      expect(tokenize('-')[0].type).toBe(TokenType.MINUS);
      expect(tokenize('*')[0].type).toBe(TokenType.STAR);
      expect(tokenize('/')[0].type).toBe(TokenType.SLASH);
      expect(tokenize('%')[0].type).toBe(TokenType.PERCENT);
    });

    it('should tokenize comparison operators', () => {
      expect(tokenize('==')[0].type).toBe(TokenType.EQEQ);
      expect(tokenize('!=')[0].type).toBe(TokenType.NEQ);
      expect(tokenize('<')[0].type).toBe(TokenType.LT);
      expect(tokenize('>')[0].type).toBe(TokenType.GT);
      expect(tokenize('<=')[0].type).toBe(TokenType.LTE);
      expect(tokenize('>=')[0].type).toBe(TokenType.GTE);
    });

    it('should tokenize assignment', () => {
      expect(tokenize('=')[0].type).toBe(TokenType.EQ);
    });

    it('should tokenize concatenation', () => {
      expect(tokenize('++')[0].type).toBe(TokenType.CONCAT);
    });

    it('should tokenize pipe operators', () => {
      expect(tokenize('/>')[0].type).toBe(TokenType.PIPE);
      expect(tokenize('/>>>')[0].type).toBe(TokenType.SPREAD_PIPE);
      expect(tokenize('\\>')[0].type).toBe(TokenType.PARALLEL_PIPE);
      expect(tokenize('</')[0].type).toBe(TokenType.REVERSE_PIPE);
      expect(tokenize('</>')[0].type).toBe(TokenType.BIDIRECTIONAL_PIPE);
      expect(tokenize('@>')[0].type).toBe(TokenType.REACTIVE_PIPE);
    });

    it('should tokenize arrow operators', () => {
      expect(tokenize('->')[0].type).toBe(TokenType.ARROW);
      expect(tokenize('<-')[0].type).toBe(TokenType.REVERSE_ARROW);
    });

    it('should tokenize type annotation operators', () => {
      expect(tokenize('::')[0].type).toBe(TokenType.DOUBLE_COLON);
      expect(tokenize(':>')[0].type).toBe(TokenType.COLON_GT);
    });
  });

  describe('delimiters', () => {
    it('should tokenize parentheses', () => {
      expect(tokenize('(')[0].type).toBe(TokenType.LPAREN);
      expect(tokenize(')')[0].type).toBe(TokenType.RPAREN);
    });

    it('should tokenize brackets', () => {
      expect(tokenize('[')[0].type).toBe(TokenType.LBRACKET);
      expect(tokenize(']')[0].type).toBe(TokenType.RBRACKET);
    });

    it('should tokenize braces', () => {
      expect(tokenize('{')[0].type).toBe(TokenType.LBRACE);
      expect(tokenize('}')[0].type).toBe(TokenType.RBRACE);
    });

    it('should tokenize punctuation', () => {
      expect(tokenize(',')[0].type).toBe(TokenType.COMMA);
      expect(tokenize(':')[0].type).toBe(TokenType.COLON);
      expect(tokenize('.')[0].type).toBe(TokenType.DOT);
      expect(tokenize('?')[0].type).toBe(TokenType.QUESTION);
      expect(tokenize('#')[0].type).toBe(TokenType.HASH);
      expect(tokenize('@')[0].type).toBe(TokenType.AT);
      expect(tokenize('|')[0].type).toBe(TokenType.PIPE_CHAR);
    });

    it('should tokenize spread operator', () => {
      expect(tokenize('...')[0].type).toBe(TokenType.SPREAD);
    });
  });

  describe('comments', () => {
    it('should skip single line comments', () => {
      const tokens = tokenize('42 -- this is a comment\n43');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].literal).toBe(42);
      expect(tokens[1].type).toBe(TokenType.NEWLINE);
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].literal).toBe(43);
    });

    it('should handle comment at end of file', () => {
      const tokens = tokenize('42 -- comment');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[1].type).toBe(TokenType.EOF);
    });
  });

  describe('codeblocks', () => {
    it('should tokenize codeblock open with label', () => {
      const tokens = tokenize('{-- Section Name --}');
      expect(tokens[0].type).toBe(TokenType.CODEBLOCK_OPEN);
      expect(tokens[0].literal).toBe('Section Name');
    });

    it('should tokenize codeblock close', () => {
      const tokens = tokenize('{/--}');
      expect(tokens[0].type).toBe(TokenType.CODEBLOCK_CLOSE);
    });
  });

  describe('complex expressions', () => {
    it('should tokenize let statement', () => {
      const types = getTokenTypes('let x = 42');
      expect(types).toEqual([
        TokenType.LET,
        TokenType.IDENTIFIER,
        TokenType.EQ,
        TokenType.NUMBER,
        TokenType.EOF,
      ]);
    });

    it('should tokenize function expression', () => {
      const types = getTokenTypes('(x) -> x * 2');
      expect(types).toEqual([
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.RPAREN,
        TokenType.ARROW,
        TokenType.IDENTIFIER,
        TokenType.STAR,
        TokenType.NUMBER,
        TokenType.EOF,
      ]);
    });

    it('should tokenize pipe chain', () => {
      const types = getTokenTypes('5 /> double /> print');
      expect(types).toEqual([
        TokenType.NUMBER,
        TokenType.PIPE,
        TokenType.IDENTIFIER,
        TokenType.PIPE,
        TokenType.IDENTIFIER,
        TokenType.EOF,
      ]);
    });

    it('should tokenize record literal', () => {
      const types = getTokenTypes('{ name: "Max", age: 99 }');
      expect(types).toEqual([
        TokenType.LBRACE,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.STRING,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.NUMBER,
        TokenType.RBRACE,
        TokenType.EOF,
      ]);
    });

    it('should tokenize list with spread', () => {
      const types = getTokenTypes('[1, ...arr, 2]');
      expect(types).toEqual([
        TokenType.LBRACKET,
        TokenType.NUMBER,
        TokenType.COMMA,
        TokenType.SPREAD,
        TokenType.IDENTIFIER,
        TokenType.COMMA,
        TokenType.NUMBER,
        TokenType.RBRACKET,
        TokenType.EOF,
      ]);
    });

    it('should tokenize function with type annotations', () => {
      const types = getTokenTypes('(x) -> x * 2 :: Int :> Int');
      expect(types).toEqual([
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.RPAREN,
        TokenType.ARROW,
        TokenType.IDENTIFIER,
        TokenType.STAR,
        TokenType.NUMBER,
        TokenType.DOUBLE_COLON,
        TokenType.IDENTIFIER,
        TokenType.COLON_GT,
        TokenType.IDENTIFIER,
        TokenType.EOF,
      ]);
    });

    it('should tokenize match expression', () => {
      const types = getTokenTypes('match x\n| 0 -> "zero"');
      expect(types).toEqual([
        TokenType.MATCH,
        TokenType.IDENTIFIER,
        TokenType.NEWLINE,
        TokenType.PIPE_CHAR,
        TokenType.NUMBER,
        TokenType.ARROW,
        TokenType.STRING,
        TokenType.EOF,
      ]);
    });

    it('should tokenize ternary expression', () => {
      const types = getTokenTypes('x > 0 ? "positive" : "non-positive"');
      expect(types).toEqual([
        TokenType.IDENTIFIER,
        TokenType.GT,
        TokenType.NUMBER,
        TokenType.QUESTION,
        TokenType.STRING,
        TokenType.COLON,
        TokenType.STRING,
        TokenType.EOF,
      ]);
    });
  });

  describe('line and column tracking', () => {
    it('should track line numbers', () => {
      const tokens = tokenize('a\nb\nc');
      expect(tokens[0].line).toBe(1);
      expect(tokens[2].line).toBe(2);
      expect(tokens[4].line).toBe(3);
    });

    it('should track column numbers', () => {
      const tokens = tokenize('let x = 42');
      expect(tokens[0].column).toBe(1);  // let
      expect(tokens[1].column).toBe(5);  // x
      expect(tokens[2].column).toBe(7);  // =
      expect(tokens[3].column).toBe(9);  // 42
    });
  });

  describe('error handling', () => {
    it('should throw on unterminated string', () => {
      expect(() => tokenize('"unterminated')).toThrow(LexerError);
      expect(() => tokenize('"unterminated')).toThrow('Unterminated string');
    });

    it('should throw on unterminated template string', () => {
      expect(() => tokenize('`unterminated')).toThrow(LexerError);
      expect(() => tokenize('`unterminated')).toThrow('Unterminated template string');
    });

    it('should throw on unexpected character', () => {
      expect(() => tokenize('~')).toThrow(LexerError);
      expect(() => tokenize('~')).toThrow("Unexpected character '~'");
    });

    it('should throw on lone backslash', () => {
      expect(() => tokenize('\\ ')).toThrow(LexerError);
      expect(() => tokenize('\\ ')).toThrow("Unexpected character '\\'");
    });

    it('should throw on lone exclamation mark', () => {
      expect(() => tokenize('!')).toThrow(LexerError);
      expect(() => tokenize('!')).toThrow("Unexpected character '!'");
    });
  });

  describe('whitespace handling', () => {
    it('should skip spaces and tabs', () => {
      const tokens = tokenize('a   b\tc');
      expect(tokens[0].lexeme).toBe('a');
      expect(tokens[1].lexeme).toBe('b');
      expect(tokens[2].lexeme).toBe('c');
    });

    it('should track newlines', () => {
      const types = getTokenTypes('a\nb');
      expect(types).toContain(TokenType.NEWLINE);
    });

    it('should handle carriage returns', () => {
      const tokens = tokenize('a\r\nb');
      expect(tokens[0].lexeme).toBe('a');
      expect(tokens[2].lexeme).toBe('b');
    });
  });
});
