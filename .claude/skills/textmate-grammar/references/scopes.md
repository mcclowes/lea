# TextMate Scope Naming

## Standard Scope Categories

### Comments

```
comment
comment.line
comment.line.double-dash.lea      -- comment
comment.block
comment.block.documentation
```

### Constants

```
constant
constant.numeric
constant.numeric.integer.lea       42
constant.numeric.float.lea         3.14
constant.language.boolean.lea      true, false
constant.character.escape.lea      \n, \t
```

### Entities

```
entity.name
entity.name.function.lea           myFunction
entity.name.type.lea               Number, String
entity.name.tag
entity.name.decorator.lea          #log, #memo
entity.other.attribute-name
```

### Invalid

```
invalid
invalid.illegal                    Syntax errors
invalid.deprecated                 Deprecated syntax
```

### Keywords

```
keyword
keyword.control.lea                if, else, match, return
keyword.control.flow.lea           return
keyword.operator.lea               +, -, *, /
keyword.operator.pipe.lea          />, />>, \>
keyword.operator.arrow.lea         ->
keyword.other
```

### Punctuation

```
punctuation
punctuation.definition.string.begin.lea    "
punctuation.definition.string.end.lea      "
punctuation.separator.comma.lea            ,
punctuation.section.block.begin.lea        {
punctuation.section.block.end.lea          }
punctuation.section.brackets.begin.lea     [
punctuation.section.brackets.end.lea       ]
punctuation.section.parens.begin.lea       (
punctuation.section.parens.end.lea         )
```

### Storage

```
storage
storage.type.lea                   let, maybe
storage.type.function.lea          -> (arrow in function)
storage.modifier.lea               context, provide
```

### Strings

```
string
string.quoted.double.lea           "hello"
string.quoted.single
string.template.lea                `template ${expr}`
string.interpolated
string.regexp
```

### Support

```
support
support.function.lea               print, map, filter
support.function.builtin.lea       Built-in functions
support.type.lea                   Number, String, List
support.class
support.constant
```

### Variables

```
variable
variable.other.lea                 x, myVar
variable.parameter.lea             Function parameters
variable.language.lea              input (placeholder)
variable.other.constant.lea        CONSTANTS
```

## Lea-Specific Scopes

```
source.lea                         Root scope

keyword.operator.pipe.forward.lea  />
keyword.operator.pipe.spread.lea   />>>
keyword.operator.pipe.parallel.lea \>
keyword.operator.pipe.reverse.lea  </

entity.name.decorator.lea          #log
meta.decorator.lea                 Full decorator expression

meta.function.lea                  Function definition
meta.function.parameters.lea       Parameter list

meta.pipeline.lea                  Pipeline expression
```

## Scope Stacking

Scopes stack from general to specific:

```
source.lea
  meta.function.lea
    storage.type.lea               "let"
    entity.name.function.lea       "double"
    meta.function.parameters.lea
      variable.parameter.lea       "x"
    keyword.operator.arrow.lea     "->"
```
