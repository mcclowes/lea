# Mermaid Syntax Reference

## Flowcharts

### Direction

```mermaid
flowchart TD  %% Top to Down
flowchart TB  %% Top to Bottom (same as TD)
flowchart BT  %% Bottom to Top
flowchart LR  %% Left to Right
flowchart RL  %% Right to Left
```

### Node Shapes

```mermaid
flowchart TD
    A[Rectangle]
    B(Rounded)
    C([Stadium])
    D[[Subroutine]]
    E[(Database)]
    F((Circle))
    G>Flag]
    H{Diamond}
    I{{Hexagon}}
    J[/Parallelogram/]
    K[\Parallelogram alt\]
```

### Links

```mermaid
flowchart TD
    A --> B           %% Arrow
    A --- B           %% Line
    A -.- B           %% Dotted
    A -.-> B          %% Dotted arrow
    A ==> B           %% Thick arrow
    A -- text --> B   %% With text
    A -->|text| B     %% Alt text syntax
```

### Subgraphs

```mermaid
flowchart TD
    subgraph Parser
        A[Lexer] --> B[Tokens]
        B --> C[AST]
    end
    subgraph Interpreter
        D[Evaluate]
    end
    C --> D
```

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant U as User
    participant R as REPL
    participant P as Parser

    U->>R: Input code
    R->>P: parse()
    P-->>R: AST
    R-->>U: Result

    Note over R,P: Parsing phase
    Note right of P: Creates AST

    alt success
        R->>U: Output
    else error
        R->>U: Error message
    end

    loop Every character
        P->>P: tokenize
    end
```

### Arrow Types

```
->    Solid line without arrow
-->   Dotted line without arrow
->>   Solid line with arrowhead
-->>  Dotted line with arrowhead
-x    Solid line with cross
--x   Dotted line with cross
-)    Solid line with open arrow
--)   Dotted line with open arrow
```

## State Diagrams

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Parsing: input
    Parsing --> Evaluating: AST
    Evaluating --> Idle: result
    Evaluating --> Error: exception
    Error --> Idle: reset
    Idle --> [*]: exit

    state Parsing {
        [*] --> Lexing
        Lexing --> Building
        Building --> [*]
    }
```

## Class Diagrams

```mermaid
classDiagram
    class Expr {
        <<interface>>
        +type: string
    }
    class NumberLiteral {
        +value: number
    }
    class BinaryExpr {
        +op: string
        +left: Expr
        +right: Expr
    }
    Expr <|-- NumberLiteral
    Expr <|-- BinaryExpr
    BinaryExpr o-- Expr : contains
```

## Styling

```mermaid
flowchart TD
    classDef literal fill:#e1f5fe,stroke:#01579b
    classDef expr fill:#fff3e0,stroke:#e65100
    classDef stmt fill:#e8f5e9,stroke:#1b5e20

    A[Number]:::literal
    B[Binary]:::expr
    C[Let]:::stmt

    style A fill:#f9f,stroke:#333
```
