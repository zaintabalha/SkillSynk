const COMMON_WORDS = new Set([
  "a", "about", "after", "all", "also", "an", "and", "are", "as", "at", "be", "been",
  "before", "being", "both", "but", "by", "can", "could", "do", "does", "each", "for",
  "from", "get", "give", "has", "have", "how", "i", "if", "in", "into", "is", "it",
  "its", "make", "more", "most", "not", "of", "on", "one", "or", "our", "out", "please",
  "should", "so", "some", "such", "than", "that", "the", "their", "them", "then", "there",
  "these", "this", "those", "through", "to", "two", "use", "using", "want", "was", "we",
  "what", "when", "which", "while", "with", "write", "you", "your", "javascript", "code",
  "solution", "task", "function", "const", "let", "var", "return", "if", "else", "for",
  "while", "true", "false", "null", "undefined", "new", "this", "export", "default",
  "ال", "في", "من", "على", "إلى", "الى", "أن", "ان", "ما", "هذا", "هذه", "هو", "هي",
  "ثم", "مع", "عن", "كل", "بعد", "قبل", "كان", "تكون", "يكون", "اكتب", "استخدم",
]);
const TOKEN_ALIASES = [
  new Set(["trim", "strip", "clean"]),
  new Set(["remove", "delete", "filter", "exclude", "drop"]),
  new Set(["empty", "blank", "null", "undefined", "boolean"]),
  new Set(["entry", "item", "tag"]),
  new Set(["sort", "order"]),
  new Set(["add", "sum", "plus"]),
  new Set(["multiply", "product", "times"]),
  new Set(["count", "length", "size"]),
  new Set(["reverse", "backwards"]),
  new Set(["unique", "distinct", "deduplicate"]),
  new Set(["validate", "check", "verify"]),
];

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim();
}

function meaningfulTokens(value: string): Set<string> {
  const camelSplit = value.replace(/([a-z0-9])([A-Z])/gu, "$1 $2");
  const tokens = camelSplit.normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}_$]+/gu) ?? [];
  return new Set(tokens.map((token) => {
    if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
    if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
    return token;
  }).filter((token) => token.length > 1 && !COMMON_WORDS.has(token)));
}

function coverage(required: Set<string>, submitted: Set<string>): number {
  if (!required.size) return 0;
  let found = 0;
  for (const token of required) {
    const aliasGroup = TOKEN_ALIASES.find((group) => group.has(token));
    if (submitted.has(token) || (aliasGroup && [...aliasGroup].some((alias) => submitted.has(alias)))) found += 1;
  }
  return found / required.size;
}

function hasBalancedDelimiters(source: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[" || character === "{") stack.push(character);
    else if (character in pairs && stack.pop() !== pairs[character]) return false;
  }

  return !quote && !blockComment && stack.length === 0;
}

export function evaluateSimulatorResponse(
  mode: "coding" | "language",
  response: string,
  expected: string,
  task: string,
): number {
  const submitted = response.trim();
  if (!submitted) return 0;
  if (normalized(submitted) === normalized(expected)) return 100;

  const submittedTokens = meaningfulTokens(submitted);
  const expectedTokens = meaningfulTokens(expected);
  const taskTokens = meaningfulTokens(task);
  const expectedCoverage = coverage(expectedTokens, submittedTokens);
  const taskCoverage = coverage(taskTokens, submittedTokens);

  if (mode === "language") {
    const precision = submittedTokens.size ? coverage(submittedTokens, expectedTokens) : 0;
    return Math.round(100 * (expectedCoverage * 0.8 + precision * 0.2));
  }

  const balanced = hasBalancedDelimiters(submitted);
  const codeSignal = /\b(?:function|const|let|var|return|if|for|while|class)\b|=>|[=+\-*/%]/u.test(submitted);
  const structuralScore = (balanced ? 60 : 0) + (codeSignal ? 40 : 0);
  return Math.max(
    0,
    Math.min(100, Math.round(expectedCoverage * 40 + taskCoverage * 30 + structuralScore * 0.3)),
  );
}
