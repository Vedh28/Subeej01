import { readFile } from "node:fs/promises";
import path from "node:path";

interface TrainingRow {
  input: string;
  output: string;
}

interface ScoredRow extends TrainingRow {
  score: number;
}

let cachedRows: TrainingRow[] | null = null;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "hello",
  "hi",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "please",
  "the",
  "to",
  "what",
  "with"
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

async function loadRows() {
  if (cachedRows) return cachedRows;

  const datasetPath = path.join(process.cwd(), "data", "training", "fast_analysis_train.jsonl");
  const raw = await readFile(datasetPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  cachedRows = lines
    .map((line) => JSON.parse(line) as { input?: string; output?: string })
    .filter((row) => row.input && row.output)
    .map((row) => ({ input: row.input as string, output: row.output as string }));

  return cachedRows;
}

export async function retrieveDatasetContext(question: string, topK = 5) {
  const rows = await loadRows();
  const tokens = tokenize(question);

  if (!tokens.length) {
    return [];
  }

  const scored: ScoredRow[] = rows
    .map((row) => {
      const haystack = `${row.input}\n${row.output}`.toLowerCase();
      let score = 0;

      for (const token of tokens) {
        if (haystack.includes(token)) score += 1;
      }

      return { ...row, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

export function buildGroundedPrompt(question: string, matches: Array<{ input: string; output: string }>) {
  if (!matches.length) {
    return `User question: ${question}

No matching dataset records were found.
Ask one short follow-up question to collect missing farm context (season, soil type, state, rainfall).`;
  }

  const context = matches
    .map(
      (match, index) =>
        `Example ${index + 1}
Input:
${match.input}
Output:
${match.output}`
    )
    .join("\n\n");

  return `User question:
${question}

You must answer using the dataset examples below.
Rules:
1) Keep response practical and concise (4-8 bullets).
2) State recommended crop and seed explicitly.
3) Mention why based on season/soil/moisture/rainfall from matched data.
4) If uncertainty remains, ask exactly one follow-up question.

Dataset examples:
${context}`;
}
