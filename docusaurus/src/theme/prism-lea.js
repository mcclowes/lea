/**
 * Prism.js language definition for Lea
 * A pipe-oriented functional programming language
 */

export default function definePrismLea(Prism) {
  Prism.languages.lea = {
    comment: {
      pattern: /--.*$/m,
      greedy: true,
    },
    string: [
      {
        // Template strings with interpolation
        pattern: /`(?:[^`\\]|\\[\s\S]|\{[^}]*\})*`/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\{[^}]*\}/,
            inside: {
              'interpolation-punctuation': {
                pattern: /^\{|\}$/,
                alias: 'punctuation',
              },
              rest: null, // Will be set after
            },
          },
          string: /[\s\S]+/,
        },
      },
      {
        // Regular strings
        pattern: /"(?:[^"\\]|\\.)*"/,
        greedy: true,
      },
    ],
    decorator: {
      pattern: /#[a-zA-Z_]\w*(?:\([^)]*\))?/,
      alias: 'function',
    },
    'context-attachment': {
      pattern: /@[a-zA-Z_]\w*/,
      alias: 'variable',
    },
    keyword: /\b(?:let|and|maybe|await|context|provide|decorator|match|if|return|input|use|true|false)\b/,
    builtin: {
      pattern: /\b(?:print|delay|sqrt|abs|floor|ceil|round|min|max|pow|log|log10|log2|exp|sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|sign|trunc|clamp|lerp|PI|E|TAU|INFINITY|random|randomInt|randomFloat|randomChoice|shuffle|length|head|tail|push|concat|reverse|isEmpty|fst|snd|zip|range|take|slice|at|map|filter|reduce|partition|listSet|setAdd|setHas|toString|toUpperCase|toLowerCase|trim|trimEnd|padStart|padEnd|split|join|replace|replaceFirst|includes|startsWith|endsWith|indexOf|charAt|chars|lines|repeat|toJson|parseJson|prettyJson|now|today|date|parseDate|formatDate|addDays|addHours|addMinutes|diffDates|readFile|writeFile|appendFile|deleteFile|fileExists|readDir|then|parallel|race|fetch|iterations|breakPieces|find|findIndex|some|every|sort|sortBy|flatten|flatMap|last|drop|takeWhile|dropWhile|count|intersperse|enumerate|transpose|unique|groupBy|sum|product|mean|median|variance|stdDev|gcd|lcm|isPrime|factorial|fibonacci|isEven|isOdd|mod|divInt|regexTest|regexMatch|regexMatchAll|regexReplace|regexSplit|camelCase|pascalCase|snakeCase|kebabCase|constantCase|capitalize|titleCase|base64Encode|base64Decode|urlEncode|urlDecode|hexEncode|hexDecode|pathJoin|dirname|basename|extname|isAbsolute|cwd|platform)\b/,
      alias: 'function',
    },
    'class-name': /\b(?:Int|String|Bool|List|Record|Function|Tuple|Pipeline)\b/,
    number: [
      {
        pattern: /\b\d+\.\d+(?:[eE][+-]?\d+)?\b/,
        alias: 'number',
      },
      {
        pattern: /\b\d+\b/,
        alias: 'number',
      },
    ],
    operator: [
      // Pipe operators (order matters - longer first)
      {
        pattern: /\/>>>/,
        alias: 'pipe-operator',
      },
      {
        pattern: /<\/>/,
        alias: 'pipe-operator',
      },
      {
        pattern: /\/>/,
        alias: 'pipe-operator',
      },
      {
        pattern: /<\//,
        alias: 'pipe-operator',
      },
      {
        pattern: /\\>/,
        alias: 'pipe-operator',
      },
      {
        pattern: /@>/,
        alias: 'pipe-operator',
      },
      // Arrow operators
      /->|<-/,
      // Type operators
      /::?|:>/,
      // Other operators
      /\+\+|\.\.\.|\?\?|==|!=|<=|>=|[+\-*/%<>=|?:,]/,
    ],
    punctuation: /[{}[\]();]/,
  };

  // Set up interpolation to use the full language
  if (Prism.languages.lea.string[0].inside) {
    Prism.languages.lea.string[0].inside.interpolation.inside.rest = Prism.languages.lea;
  }
}
