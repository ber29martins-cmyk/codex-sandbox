export type ClinicalBlocks = {
  anamnese: string[];
  exame: string[];
  hipotese: string[];
  conduta: string[];
};

function collapseWhitespace(input: string) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function shouldAppendPeriod(line: string) {
  if (!line) return false;
  if (/[.!?]$/.test(line)) return false;
  if (line.includes(":")) return false;
  if (line.includes("|")) return false;
  return true;
}

function normalizeLine(line: string) {
  const cleaned = collapseWhitespace(line);
  if (!cleaned) return "";
  return shouldAppendPeriod(cleaned) ? `${cleaned}.` : cleaned;
}

function dedupeKey(line: string) {
  return collapseWhitespace(line)
    .toLocaleLowerCase("pt-BR")
    .replace(/[.!?]+$/g, "");
}

export function applyClinicalNarrativeCohesion(lines: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const trimmedRaw = String(raw ?? "").trim();
    if (!trimmedRaw) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }

    const normalized = normalizeLine(trimmedRaw);
    if (!normalized) continue;
    const key = dedupeKey(normalized);
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(normalized);
  }

  while (out.length && out[0] === "") out.shift();
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

export function applyClinicalNarrativeCohesionToBlocks(blocks: ClinicalBlocks): ClinicalBlocks {
  return {
    anamnese: applyClinicalNarrativeCohesion(blocks.anamnese),
    exame: applyClinicalNarrativeCohesion(blocks.exame),
    hipotese: applyClinicalNarrativeCohesion(blocks.hipotese),
    conduta: applyClinicalNarrativeCohesion(blocks.conduta)
  };
}
