import test from "node:test";
import assert from "node:assert/strict";
import templatesData from "../src/templates/templates.json" with { type: "json" };
import {
  applyClinicalNarrativeCohesion,
  applyClinicalNarrativeCohesionToBlocks
} from "../src/lib/clinicalNarrative.ts";

const templates = templatesData.templates ?? [];

function hasTerminalPunctuation(line) {
  return /[.!?]$/.test(line);
}

function shouldRequireTerminalPunctuation(line) {
  if (!line) return false;
  if (line.includes(":")) return false;
  if (line.includes("|")) return false;
  return true;
}

test("camada de coesão normaliza espaçamento, pontuação e deduplicação", () => {
  const lines = [
    "  Refere febre  ",
    "Refere febre.",
    "Nega   dispneia",
    "",
    "  ",
    "Comorbidades: DM,  HAS"
  ];

  const cohesive = applyClinicalNarrativeCohesion(lines);

  assert.deepEqual(cohesive, [
    "Refere febre.",
    "Nega dispneia.",
    "",
    "Comorbidades: DM, HAS"
  ]);
});

test("regressão todos os templates: cenário de seleção máxima mantém narrativa coesa", () => {
  assert.ok(templates.length > 0, "sem templates para validar");

  for (const template of templates) {
    const label = template?.label ?? "Queixa";
    const hmaItems = Array.isArray(template?.defaults?.hmaItems) ? template.defaults.hmaItems : [];
    const alarmItems = Array.isArray(template?.defaults?.alarmItems) ? template.defaults.alarmItems : [];
    const exameBase = Array.isArray(template?.defaults?.exame) ? template.defaults.exame : [];
    const hipotese = template?.defaults?.hipotese ?? label;

    const maxAnamnese = [
      `QP: ${label}`,
      ...hmaItems.map((item) => `Refere ${String(item?.label ?? "").toLowerCase()}`),
      ...hmaItems.map((item) => `Nega ${String(item?.label ?? "").toLowerCase()}`),
      `Sinais de alarme presentes: ${alarmItems.map((item) => item?.label).filter(Boolean).join(", ")}`,
      "Comorbidades: DM, HAS",
      "Comorbidades: DM, HAS",
      "Nega alergias"
    ];

    const maxExame = [
      "PA 120/80 mmHg | FC 80 bpm | SatO2 98%",
      ...exameBase,
      ...exameBase,
      "Sem alterações focais"
    ];

    const maxConduta = [
      "Prescrevo analgésicos",
      "Orientado sobre o quadro e conduta",
      "Oriento sinais de alarme e retorno imediato, se necessário.",
      "Paciente esclarecido e de acordo com as orientações",
      "Paciente esclarecido e de acordo com as orientações"
    ];

    const cohesive = applyClinicalNarrativeCohesionToBlocks({
      anamnese: maxAnamnese,
      exame: maxExame,
      hipotese: [hipotese],
      conduta: maxConduta
    });

    for (const key of ["anamnese", "exame", "hipotese", "conduta"]) {
      const lines = cohesive[key];
      assert.ok(Array.isArray(lines), `bloco inválido: ${key} no template ${template.id}`);
      const seen = new Set();
      for (const raw of lines) {
        if (!raw) continue;
        assert.equal(raw, raw.trim(), `linha com espaços extras: ${key} template ${template.id}`);
        assert.equal(/\s{2,}/.test(raw), false, `linha com espaços duplicados: ${key} template ${template.id}`);
        if (shouldRequireTerminalPunctuation(raw)) {
          assert.equal(hasTerminalPunctuation(raw), true, `pontuação final ausente: ${key} template ${template.id}`);
        }
        const dedupeKey = raw.toLocaleLowerCase("pt-BR").replace(/[.!?]+$/g, "");
        assert.equal(seen.has(dedupeKey), false, `linha duplicada: ${key} template ${template.id}`);
        seen.add(dedupeKey);
      }
    }

    const baseText = `${cohesive.anamnese.join("\n")}\n\n${cohesive.exame.join("\n")}\n\n${cohesive.hipotese.join("\n")}\n\n${cohesive.conduta.join("\n")}`;
    assert.ok(baseText.includes("\n\n"), `quebra de seções inválida no template ${template.id}`);
    assert.equal(baseText.includes("undefined"), false, `texto inválido no template ${template.id}`);
  }
});
