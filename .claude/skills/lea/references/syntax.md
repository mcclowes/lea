# Lea Syntax Reference

## Comments

```lea
-- This is a comment
```

## Bindings

```lea
let x = 10              -- Immutable
let mut counter = 0     -- Mutable
```

## Functions

```lea
let double = (x) -> x * 2
let add = (a, b) -> a + b
let typed = (x: Int): Int -> x + 1

-- With decorators (trailing, after body)
let logged = (x) -> x * 2 #log #memo #time
```

## Pipes

```lea
16 /> sqrt              -- sqrt(16) = 4
5 /> add(3)             -- add(5, 3) - value becomes first arg
5 /> add(3, _)          -- add(3, 5) - placeholder controls position
```

## Lists

```lea
[1, 2, 3] /> map((x) -> x * 2)
[1, 2, 3] /> filter((x) -> x > 1)
[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)
```

## Strings

```lea
"Hello" ++ " World"     -- Concatenation
```

## Comparison Operators

```lea
x == y    -- Equal
x != y    -- Not equal
x < y     -- Less than
x > y     -- Greater than
x <= y    -- Less than or equal
x >= y    -- Greater than or equal
```

## Token Types

```
NUMBER, STRING, IDENTIFIER
LET, MUT, TRUE, FALSE
PIPE (/>), ARROW (->)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, UNDERSCORE (_), HASH (#), AT (@)
NEWLINE, EOF
```

## Parser Precedence (low to high)

1. Pipe (`/>`)
2. Equality (`==`, `!=`)
3. Comparison (`<`, `>`, `<=`, `>=`)
4. Term (`+`, `-`, `++`)
5. Factor (`*`, `/`, `%`)
6. Unary (`-`)
7. Call (function calls, indexing)
8. Primary (literals, identifiers, grouping, functions)
