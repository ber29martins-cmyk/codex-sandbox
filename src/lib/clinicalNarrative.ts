export type ClinicalBlocks = {
  anamnese: string[];
  exame: string[];
  hipotese: string[];
  conduta: string[];
};

type NarrativeState = "presente" | "nega";

type NarrativeItem = {
  id?: string;
  label?: string;
  text?: string;
  presentText?: string;
  absentText?: string;
  absentLabel?: string;
};

function collapseWhitespace(input: string) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function toNarrativeComplement(raw: string, state: NarrativeState) {
  let text = collapseWhitespace(raw).replace(/[.!?]+$/g, "").trim();
  if (!text) return "";

  const prefixes =
    state === "presente"
      ? [/^refere\s+/i, /^com\s+/i, /^presen[çc]a de\s+/i, /^apresenta\s+/i]
      : [/^nega\s+/i, /^sem\s+/i, /^aus[êe]ncia de\s+/i, /^n[aã]o refere\s+/i, /^refere\s+/i];

  for (const prefix of prefixes) {
    text = text.replace(prefix, "").trim();
  }

  if (!text) return "";
  return text.charAt(0).toLocaleLowerCase("pt-BR") + text.slice(1);
}

export function collectStateNarrativeComplements(
  items: NarrativeItem[],
  states: Record<string, "unknown" | NarrativeState>,
  state: NarrativeState
) {
  const complements: string[] = [];
  for (const item of items) {
    const itemState = states[String(item.id ?? "")] ?? "unknown";
    if (itemState !== state) continue;

    const source =
      state === "presente"
        ? item.presentText || item.text || item.label || ""
        : item.absentText || item.absentLabel || item.text || item.label || "";
    const normalized = toNarrativeComplement(source, state);
    if (normalized) complements.push(normalized);
  }
  return complements;
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
