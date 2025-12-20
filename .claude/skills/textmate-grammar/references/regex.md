# Oniguruma Regex Reference

TextMate grammars use Oniguruma regex engine.

## Basic Patterns

```regex
.       Any character except newline
\d      Digit [0-9]
\D      Non-digit
\w      Word character [a-zA-Z0-9_]
\W      Non-word character
\s      Whitespace
\S      Non-whitespace
\b      Word boundary
```

## Quantifiers

```regex
*       Zero or more
+       One or more
?       Zero or one
{n}     Exactly n
{n,}    n or more
{n,m}   Between n and m
```

## Character Classes

```regex
[abc]       a, b, or c
[^abc]      Not a, b, or c
[a-z]       Range a to z
[a-zA-Z]    Any letter
[\d\s]      Digit or whitespace
```

## Groups and Captures

```regex
(abc)       Capturing group
(?:abc)     Non-capturing group
(?<name>x)  Named capture (Oniguruma)
\1          Backreference to group 1
```

## Lookahead/Lookbehind

```regex
(?=abc)     Positive lookahead
(?!abc)     Negative lookahead
(?<=abc)    Positive lookbehind
(?<!abc)    Negative lookbehind
```

## Common Patterns for Languages

### Identifiers

```regex
[a-zA-Z_][a-zA-Z0-9_]*
```

### Numbers

```regex
# Integer
\b\d+\b

# Float
\b\d+\.\d+\b

# Both
\b\d+(\.\d+)?\b
```

### Strings

```regex
# Double quoted
"[^"\\]*(\\.[^"\\]*)*"

# With escapes
"(?:[^"\\]|\\.)*"
```

### Operators

```regex
# Pipe operators
/>|/>>>|\\>|</

# Comparison
==|!=|<=|>=|<|>

# Arithmetic
[+\-*/%]
```

### Keywords

```regex
\b(let|maybe|if|else|match|return)\b
```

### Decorators

```regex
#[a-zA-Z_][a-zA-Z0-9_]*(?:\([^)]*\))?
```

## Escaping Special Characters

These must be escaped in regex:
```
\ . * + ? ^ $ { } [ ] ( ) | /
```

In JSON, double-escape:
```json
{
  "match": "\\blet\\b"
}
```

## Multiline Patterns

```regex
# Begin/end instead of match
"begin": "/\\*",
"end": "\\*/"
```

## Performance Tips

1. Avoid catastrophic backtracking: `(a+)+`
2. Use possessive quantifiers when possible: `a++`
3. Anchor patterns when possible: `^`, `$`
4. Use specific character classes over `.`
