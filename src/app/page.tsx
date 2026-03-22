"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type BlockKey = "anamnese" | "exame" | "hipotese" | "conduta";
type AlarmStatus = "unknown" | "nega" | "presente";
type AlarmStateMap = Record<string, AlarmStatus>;
type HmaStateMap = Record<string, AlarmStatus>;
type Template = {
  id: string;
  label: string;
  defaults: {
    qp?: string;
    qpDefault?: string;
    hmaItems?: { id: string; label: string; text: string }[];
    hmaDefaults?: string[];
    alarme: string;
    comorb: string;
    meds: string;
    hipotese: string;
    condutaAlarmes: string;
    exame: string[];
    alarmItems?: AlarmItem[];
    rxGroups?: string[];
    rxDefaults?: string[];
  };
};
type TemplateState = {
  qpText: string;
  alarme: string;
  comorb: string;
  meds: string;
  alergiaNega: boolean;
  alergiaTexto: string;
  hipotese: string;
  condutaAlarmes: string;
  alarmStates: AlarmStateMap;
  rxSelected: string[];
  rxFormulationByItem?: Record<string, string>;
  rxRegimenByItem?: Record<string, string>;
  triagem: boolean;
  pa: string;
  fc: string;
  sat: string;
  tax: string;
  comorbSelected: string[];
  atestadoEmitir?: boolean;
  atestadoDias?: number;
  atestadoCid?: string;
  exameLivre?: string;
};
type AlarmItem = { id: string; label: string; absentLabel: string; presentText: string };
type RxItem = {
  id: string;
  label: string;
  route: string;
  title: string;
  brand?: string;
  qty: string;
  directions: string[];
  peds?: {
    minAgeMonths?: number;
    minWeightKg?: number;
    mgKg?: { min: number; max: number };
    ageBands?: Array<{
      minAgeMonths: number;
      maxAgeMonths?: number;
      doseMg: number;
      doseMgMax?: number;
      intervalHours?: number;
      dosesPerDay?: number;
      note?: string;
    }>;
    intervalHours?: { min: number; max: number };
    regimens?: Array<{
      id: string;
      label: string;
      mgKg?: { min: number; max: number };
      intervalHours?: { min: number; max: number };
      maxPerDoseMg?: number;
      maxPerDayMgKg?: number;
      maxDosesPerDay?: number;
      notes?: string[];
      azithroStep?: {
        day1MgKg: number;
        day2to5MgKg: number;
        maxPerDayMg?: number;
      };
      singleDoseMgKg?: number;
    }>;
    maxPerDoseMg?: number;
    maxPerDayMgKg?: number;
    maxDosesPerDay?: number;
    notes?: string[];
    formulations?: Array<{ label: string; mgPerMl?: number; mgPer5ml?: number }>;
  };
};
type RxGroup = { id: string; label: string; itemIds: string[] };
type RxSelectionOption = {
  key: string;
  title: string;
  route: string;
  itemIds: string[];
};

const ALARM_STATUS_ORDER: AlarmStatus[] = ["unknown", "nega", "presente"];
const ALARM_STATUS_LABELS: Record<AlarmStatus, string> = {
  unknown: "Não avaliado",
  nega: "Nega",
  presente: "Presente"
};
const ALARM_STATUS_STYLES: Record<AlarmStatus, { background: string; border: string; color: string }> = {
  unknown: { background: "#f5f5f5", border: "#d0d0d0", color: "#444" },
  nega: { background: "#e6f4ea", border: "#c5e1ca", color: "#1b5e20" },
  presente: { background: "#fdecea", border: "#f5c6bf", color: "#7f1d1d" }
};
const STORAGE_KEY = "codex-app-state-v1";
const HMA_SELECTED_PREFIX = "mvp:hmaSelected:";
const HMA_FREE_PREFIX = "mvp:hmaFree:";
const RX_ROUTE_ORDER = ["ORAL", "PARENTERAL", "TOPICO", "OFTALMICO", "INALATORIO"];
const RX_KIT_KEY = "codex-rx-kits-v1";
const PRIVACY_KEY = "privacy_ack_v1";
const BETA_STORAGE_KEY = "beta_access_v2";
const LEGACY_BETA_STORAGE_KEY = "beta_access_v1";
const PROFILE_STORAGE_KEY = "patient_profile_v1";

function buildDefaultAlarmStates(template: Template): AlarmStateMap {
  const items = template.defaults.alarmItems ?? [];
  if (!items.length) return {};

  const initialState: AlarmStateMap = {};
  for (const item of items) {
    initialState[item.id] = "nega";
  }
  return initialState;
}

function getTemplateQP(template: Template) {
  const qpCandidates = [
    template.defaults.qpDefault,
    template.defaults.qp,
    ...(((template as unknown as { complaintItems?: string[] }).complaintItems ?? []).slice(0, 1)),
    ...(((template as unknown as { symptoms?: string[] }).symptoms ?? []).slice(0, 1))
  ].filter(Boolean) as string[];
  return qpCandidates[0] ?? "";
}

function isTemplateIdCompatibleWithProfile(id: string, profile: "adulto" | "pediatria") {
  if (!id) return false;
  const isPediatricTemplate = id.toLowerCase().startsWith("ped_");
  return profile === "pediatria" ? isPediatricTemplate : !isPediatricTemplate;
}

function shortenLabel(text: string, maxLen = 42) {
  const clean = text.replace(/^Refere\s+/i, "").replace(/^Nega\s+/i, "").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

function normalizeHmaLabel(label: string) {
  return label.replace(/^(nega|sem|não|ausência de)\s+/i, "").trim();
}

function cleanAlarmLabel(s: string) {
  return s.replace(/^(sem|nega)\s+/i, "").replace(/^não\s+apresenta\s+/i, "").trim();
}

const ALARM_PRINT_MAP: Record<string, string> = {
  "Dispneia/esforço": "dispneia ou esforço respiratório",
  "Sat baixa": "saturação baixa",
  "Dor torácica": "dor torácica",
  "Dor torácica imp": "dor torácica importante",
  "Hemoptise": "hemoptise",
  "Febre >72h": "febre persistente (>72h)",
  "Febre alta >72h": "febre alta ou persistente (>72h)",
  "Febre >72h/piora": "febre persistente (>72h) ou piora após melhora",
  "Piora progressiva": "piora progressiva",
  "Piora após melhora": "piora após melhora",
  "Incapaz VO/desid": "incapaz de via oral ou sinais de desidratação importante",
  "Desid importante": "sinais de desidratação importante",
  "Desid/baixa VO": "desidratação importante ou baixa aceitação via oral",
  "Vômitos incoerc": "vômitos incoercíveis",
  "Confusão/rebaix": "confusão mental ou rebaixamento",
  "Confusão/sonol": "confusão mental ou sonolência importante",
  "confusão": "confusão mental ou alteração do nível de consciência",
  "Febre/calafrios": "febre e calafrios",
  "Dor flanco/lomb": "dor em flanco ou lombalgia",
  "N/V importantes": "náuseas ou vômitos importantes",
  "Sepse hipot/conf": "sinais de sepse com hipotensão ou confusão",
  "Falha terapêut": "piora progressiva ou falha terapêutica",
  "Hematêmese": "hematêmese",
  "Melena/sangram": "melena ou sangramento digestivo",
  "Perda ponderal": "perda ponderal ou anorexia importante",
  "Disfagia prog": "disfagia ou odinofagia progressiva",
  "Vômitos persist": "vômitos persistentes",
  "Síncope/hipot": "síncope ou hipotensão",
  "Equiv anginoso": "dor torácica em aperto ou dispneia (equivalente anginoso)",
  "Anemia suspeita": "anemia conhecida ou suspeita",
  "Sangue nas fezes": "sangue nas fezes ou melena",
  "Dor abd intensa": "dor abdominal intensa ou localizada",
  "Choque": "sinais de choque",
  "Suspeita colite": "uso recente de antibiótico com suspeita de colite",
  "Dor retroauric": "dor retroauricular",
  "Edema retroauric": "edema retroauricular",
  "Pavilhão protru": "pavilhão auricular protruído",
  "Paralisia facial": "paralisia facial",
  "Cefaleia intensa": "cefaleia intensa",
  "Meningismo": "rigidez de nuca ou sinais meníngeos",
  "Toxemia": "toxemia ou mau estado geral",
  "Dispneia/estridor": "dispneia ou estridor",
  "Sialorreia/VO": "sialorreia ou incapacidade de deglutir saliva",
  "Trismo/voz abaf": "trismo ou voz abafada",
  "Desvio de úvula": "desvio de úvula (suspeita de abscesso peritonsilar)",
  "Desid/recusa VO": "desidratação importante ou recusa via oral",
  "Febre alta/tox": "febre alta persistente ou toxemia",
  "Déficit sensitivo": "parestesia ou hipoestesia",
  "Perda de força": "perda de força",
  "Alteração esfinc": "alteração esfincteriana",
  "Anestesia em sela": "anestesia em sela",
  "Fala entrecort": "fala entrecortada ou incapacidade de falar frases",
  "Tórax silenc": "tórax silencioso ou redução importante do murmúrio vesicular",
  "Exaustão": "exaustão respiratória iminente",
  "Cianose": "cianose",
  "Rebaixamento": "rebaixamento do nível de consciência",
  "dor despropor": "dor desproporcional",
  "dor desproporc": "dor desproporcional",
  "rápida progress": "progressão rápida",
  "falha 48-72h": "falha terapêutica em 48–72 horas",
  "pior cefaleia": "pior cefaleia da vida ou mudança abrupta do padrão",
  "início súbito": "início súbito tipo trovoada",
  "déficit neuro": "déficit neurológico focal",
  "febre/mening": "febre ou sinais meníngeos",
  "trauma": "trauma craniano associado",
  "papiledema": "papiledema ou sinais de hipertensão intracraniana",
  "gravidez": "gravidez ou puerpério",
  "hipotensão": "hipotensão ou sinais de choque",
  "taquicardia": "taquicardia ou instabilidade hemodinâmica",
  "incapaz deglut": "incapacidade de deglutir ou recusa via oral",
  "dispneia/estridor": "dispneia / estridor",
  "sinais infecção": "sinais de infecção secundária"
};

function parseAgeMonths(ageRaw: string): { months: number | null; display: string } {
  const raw = ageRaw.trim();
  if (!raw) return { months: null, display: "" };
  const lower = raw.toLowerCase();
  const isMonths = lower.includes("mes") || (lower.includes("m") && !lower.includes("ano"));
  const numMatch = raw.match(/[0-9]+([.,][0-9]+)?/);
  const num = numMatch ? Number(numMatch[0].replace(",", ".")) : NaN;
  if (!Number.isFinite(num)) return { months: null, display: raw };
  const months = isMonths ? num : num * 12;
  const display = isMonths ? `${num}${raw.includes(" ") ? "" : " meses"}`.trim() : `${num} anos`;
  return { months, display };
}

function parseWeightKg(weightRaw: string): number | null {
  const raw = weightRaw.trim();
  if (!raw) return null;
  const match = raw.match(/[0-9]+([.,][0-9]+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function formatDoseValue(value: number) {
  if (!Number.isFinite(value)) return "";
  if (value < 10) return value.toFixed(1).replace(/\.0$/, "");
  return Math.round(value).toString();
}

function formatDoseRange(min: number, max: number, unit: string) {
  const minTxt = formatDoseValue(min);
  const maxTxt = formatDoseValue(max);
  if (!minTxt || !maxTxt) return "";
  if (Math.abs(min - max) < 0.01) return `${minTxt} ${unit}`;
  return `${minTxt} a ${maxTxt} ${unit}`;
}

function parseMgPerUnitFromLabel(label: string): number | null {
  const lower = String(label || "").toLowerCase();
  const match = lower.match(/([0-9]+([.,][0-9]+)?)\s*mg/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function getAgeBandDose(
  ageBands: NonNullable<RxItem["peds"]>["ageBands"],
  ageMonths: number | null
) {
  if (!ageBands?.length) return null;
  if (ageMonths === null) return null;
  return (
    ageBands.find((band) => {
      const min = band.minAgeMonths ?? 0;
      const max = band.maxAgeMonths;
      if (ageMonths < min) return false;
      if (typeof max === "number" && ageMonths >= max) return false;
      return true;
    }) ?? null
  );
}

function getRxDirections(
  item: RxItem,
  profile: "adulto" | "pediatria",
  weightKg: number | null,
  ageMonths: number | null,
  selectedFormulationLabel?: string,
  selectedRegimenId?: string
) {
  const base = [...(item.directions ?? [])];
  if (profile !== "pediatria" || !item.peds) return base;

  const peds = item.peds;
  const selectedRegimen = peds.regimens?.find((r) => r.id === selectedRegimenId) ?? peds.regimens?.[0];
  const effectiveMgKg = selectedRegimen?.mgKg ?? peds.mgKg;
  const effectiveInterval = selectedRegimen?.intervalHours ?? peds.intervalHours;
  const effectiveMaxPerDose = selectedRegimen?.maxPerDoseMg ?? peds.maxPerDoseMg;
  const effectiveMaxPerDayMgKg = selectedRegimen?.maxPerDayMgKg ?? peds.maxPerDayMgKg;
  const effectiveMaxDosesPerDay = selectedRegimen?.maxDosesPerDay ?? peds.maxDosesPerDay;
  const extra: string[] = [];
  const hasAgeBands = Array.isArray(peds.ageBands) && peds.ageBands.length > 0;
  const hasMgKg = Boolean(effectiveMgKg);

  if (typeof peds.minAgeMonths === "number" && ageMonths !== null && ageMonths < peds.minAgeMonths) {
    extra.push(`Atenção: uso recomendado apenas a partir de ${peds.minAgeMonths} meses.`);
  }
  if (typeof peds.minWeightKg === "number") {
    if (weightKg === null) {
      extra.push(`Preencher peso para validar uso (minimo ${peds.minWeightKg}kg).`);
    } else if (weightKg < peds.minWeightKg) {
      extra.push(`Atenção: indicado para peso >= ${peds.minWeightKg}kg.`);
    }
  }

  if (selectedRegimen?.singleDoseMgKg) {
    if (!weightKg) {
      extra.push("Tomar conforme peso (preencher peso para cálculo da dose).");
    } else {
      const mgDoseRaw = weightKg * selectedRegimen.singleDoseMgKg;
      const mgDose = typeof effectiveMaxPerDose === "number" ? Math.min(mgDoseRaw, effectiveMaxPerDose) : mgDoseRaw;
      const forms = selectedFormulationLabel
        ? (peds.formulations ?? []).filter((f) => f.label.toLowerCase() === selectedFormulationLabel.toLowerCase())
        : (peds.formulations ?? []).slice(0, 1);
      forms.forEach((form) => {
        const mgPerMl =
          typeof form.mgPerMl === "number" ? form.mgPerMl : typeof form.mgPer5ml === "number" ? form.mgPer5ml / 5 : null;
        if (mgPerMl && mgPerMl > 0) {
          const ml = mgDose / mgPerMl;
          if (form.label.toLowerCase().includes("gota")) {
            extra.push(`Dose única: ${formatDoseValue(ml * 20)} gotas (${formatDoseValue(mgDose)}mg; ${selectedRegimen.singleDoseMgKg}mg/kg).`);
          } else {
            extra.push(`Dose única: ${formatDoseValue(ml)}mL (${formatDoseValue(mgDose)}mg; ${selectedRegimen.singleDoseMgKg}mg/kg).`);
          }
        } else {
          extra.push(`Dose única: ${formatDoseValue(mgDose)}mg (${selectedRegimen.singleDoseMgKg}mg/kg).`);
        }
      });
    }
    if (selectedRegimen.notes?.length) {
      selectedRegimen.notes.forEach((n) => n && extra.push(`Obs: ${n}.`));
    }
    return [...base.filter(Boolean), ...extra];
  }

  if (selectedRegimen?.azithroStep) {
    const step = selectedRegimen.azithroStep;
    if (!weightKg) {
      extra.push("Preencher peso para cálculo do esquema dia 1 e dias 2-5.");
    } else {
      const d1mgRaw = weightKg * step.day1MgKg;
      const d2mgRaw = weightKg * step.day2to5MgKg;
      const maxDay = step.maxPerDayMg ?? effectiveMaxPerDose;
      const d1mg = typeof maxDay === "number" ? Math.min(d1mgRaw, maxDay) : d1mgRaw;
      const d2mg = typeof maxDay === "number" ? Math.min(d2mgRaw, maxDay) : d2mgRaw;
      const forms = selectedFormulationLabel
        ? (peds.formulations ?? []).filter((f) => f.label.toLowerCase() === selectedFormulationLabel.toLowerCase())
        : (peds.formulations ?? []).slice(0, 1);
      forms.forEach((form) => {
        const mgPerMl =
          typeof form.mgPerMl === "number" ? form.mgPerMl : typeof form.mgPer5ml === "number" ? form.mgPer5ml / 5 : null;
        if (mgPerMl && mgPerMl > 0) {
          extra.push(`Dia 1: ${formatDoseValue(d1mg / mgPerMl)}mL (${formatDoseValue(d1mg)}mg; ${step.day1MgKg}mg/kg).`);
          extra.push(`Dias 2-5: ${formatDoseValue(d2mg / mgPerMl)}mL 1x/dia (${formatDoseValue(d2mg)}mg; ${step.day2to5MgKg}mg/kg).`);
        } else {
          extra.push(`Dia 1: ${formatDoseValue(d1mg)}mg; Dias 2-5: ${formatDoseValue(d2mg)}mg 1x/dia.`);
        }
      });
    }
    if (selectedRegimen.notes?.length) {
      selectedRegimen.notes.forEach((n) => n && extra.push(`Obs: ${n}.`));
    }
    return [...base.filter(Boolean), ...extra];
  }

  const ageBand = getAgeBandDose(peds.ageBands, ageMonths);

  if (!hasAgeBands && !hasMgKg) {
    return [...base.filter(Boolean), ...extra];
  }

  if (hasAgeBands && ageMonths === null) {
    extra.push("Preencher idade para cálculo automático por faixa etária.");
  } else if (!hasAgeBands && (!weightKg || !peds.mgKg)) {
    extra.push("Tomar conforme peso (preencher peso para cálculo da dose).");
  } else if (ageBand) {
    const doseMgRawMin = ageBand.doseMg;
    const doseMgRawMax = typeof ageBand.doseMgMax === "number" ? ageBand.doseMgMax : ageBand.doseMg;
    const doseMgMin = typeof effectiveMaxPerDose === "number" ? Math.min(doseMgRawMin, effectiveMaxPerDose) : doseMgRawMin;
    const doseMgMax = typeof effectiveMaxPerDose === "number" ? Math.min(doseMgRawMax, effectiveMaxPerDose) : doseMgRawMax;
    const intervalH =
      ageBand.intervalHours ?? effectiveInterval?.min ?? effectiveInterval?.max ?? (ageBand.dosesPerDay ? Math.floor(24 / ageBand.dosesPerDay) : null);
    if (Array.isArray(peds.formulations)) {
      const selected = selectedFormulationLabel?.trim().toLowerCase();
      const forms = selected
        ? peds.formulations.filter((form) => form.label.trim().toLowerCase() === selected)
        : peds.formulations.slice(0, 1);
      forms.forEach((form) => {
        const lower = form.label.toLowerCase();
        const mgPerMl =
          typeof form.mgPerMl === "number" ? form.mgPerMl : typeof form.mgPer5ml === "number" ? form.mgPer5ml / 5 : null;
        if (mgPerMl && mgPerMl > 0) {
          const mlMin = doseMgMin / mgPerMl;
          const mlMax = doseMgMax / mgPerMl;
          if (lower.includes("gota")) {
            const gotasTxt = formatDoseRange(mlMin * 20, mlMax * 20, "gotas");
            extra.push(
              `Tomar ${gotasTxt} por dose (${formatDoseRange(doseMgMin, doseMgMax, "mg/dose")})${intervalH ? `, a cada ${intervalH} horas` : ""}.`
            );
          } else {
            const mlTxt = formatDoseRange(mlMin, mlMax, "mL");
            extra.push(
              `Tomar ${mlTxt} por dose (${formatDoseRange(doseMgMin, doseMgMax, "mg/dose")})${intervalH ? `, a cada ${intervalH} horas` : ""}.`
            );
          }
          return;
        }
        if (lower.includes("comprimido")) {
          const mgPerComp = parseMgPerUnitFromLabel(form.label);
          if (mgPerComp && mgPerComp > 0) {
            const compTxt = formatDoseRange(doseMgMin / mgPerComp, doseMgMax / mgPerComp, "comprimido(s)");
            extra.push(
              `Tomar ${compTxt} por dose (${formatDoseRange(doseMgMin, doseMgMax, "mg/dose")})${intervalH ? `, a cada ${intervalH} horas` : ""}.`
            );
            return;
          }
        }
        extra.push(`Tomar ${formatDoseRange(doseMgMin, doseMgMax, "mg")} por dose${intervalH ? `, a cada ${intervalH} horas` : ""}.`);
      });
    }
    if (ageBand.note) {
      extra.push(`Obs: ${ageBand.note}.`);
    }
  } else {
    if (!weightKg || !effectiveMgKg) {
      extra.push("Sem faixa etária compatível para idade informada.");
      return extra.length ? extra : base.filter(Boolean);
    }
    const mgMinRaw = weightKg * effectiveMgKg.min;
    const mgMaxRaw = weightKg * effectiveMgKg.max;
    const mgMin = typeof effectiveMaxPerDose === "number" ? Math.min(mgMinRaw, effectiveMaxPerDose) : mgMinRaw;
    const mgMax = typeof effectiveMaxPerDose === "number" ? Math.min(mgMaxRaw, effectiveMaxPerDose) : mgMaxRaw;
    const mgKgTxt = `${effectiveMgKg.min}-${effectiveMgKg.max} mg/kg/dose`;
    const intervalText = effectiveInterval
      ? `, a cada ${effectiveInterval.min}-${effectiveInterval.max} horas`
      : "";
    if (Array.isArray(peds.formulations)) {
      const selected = selectedFormulationLabel?.trim().toLowerCase();
      const forms = selected
        ? peds.formulations.filter((form) => form.label.trim().toLowerCase() === selected)
        : peds.formulations.slice(0, 1);
      forms.forEach((form) => {
        const mgPerMl =
          typeof form.mgPerMl === "number" ? form.mgPerMl : typeof form.mgPer5ml === "number" ? form.mgPer5ml / 5 : null;
        if (!mgPerMl || mgPerMl <= 0) return;
        const mlMin = mgMin / mgPerMl;
        const mlMax = mgMax / mgPerMl;
        if (form.label.toLowerCase().includes("gota")) {
          const gotasMin = mlMin * 20;
          const gotasMax = mlMax * 20;
          const gotasTxt = formatDoseRange(gotasMin, gotasMax, "gotas");
          if (gotasTxt) {
            extra.push(`Tomar ${gotasTxt} por dose (${mgKgTxt})${intervalText}.`);
          }
        } else {
          const mlTxt = formatDoseRange(mlMin, mlMax, "mL");
          if (mlTxt) {
            extra.push(`Tomar ${mlTxt} por dose (${mgKgTxt})${intervalText}.`);
          }
        }
      });
    }
    if (typeof effectiveMaxPerDayMgKg === "number") {
      extra.push(`Máximo diário: ${effectiveMaxPerDayMgKg} mg/kg/dia.`);
    }
    if (typeof effectiveMaxDosesPerDay === "number") {
      extra.push(`Máximo de ${effectiveMaxDosesPerDay} doses por dia.`);
    }
  }

  if (Array.isArray(peds.notes)) {
    peds.notes.forEach((note) => {
      const clean = String(note || "").trim();
      if (clean) extra.push(`Obs: ${clean}.`);
    });
  }
  if (selectedRegimen?.notes?.length) {
    selectedRegimen.notes.forEach((note) => {
      const clean = String(note || "").trim();
      if (clean) extra.push(`Obs: ${clean}.`);
    });
  }

  return extra.length ? extra : base.filter(Boolean);
}

function alarmLabelForPrint(input: string) {
  const cleaned = cleanAlarmLabel(input).trim();
  const expanded = ALARM_PRINT_MAP[cleaned] ?? ALARM_PRINT_MAP[cleaned.toLowerCase()] ?? cleaned;
  return expanded.toLocaleLowerCase("pt-BR");
}

function formatParagraph(lines: string[]) {
  const parts: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const hasPunct = /[.!?]$/.test(line);
    parts.push(hasPunct ? line : `${line}.`);
  }
  return parts.join(" ");
}

function formatList(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  const last = items[items.length - 1];
  return `${items.slice(0, -1).join(", ")} e ${last}`;
}

function buildPresentNarrative(labels: string[]) {
  if (!labels.length) return "";
  if (labels.length === 1) return `Refere ${labels[0]}.`;
  const [first, ...rest] = labels;
  return `Refere ${first}, associado a ${formatList(rest)}.`;
}

function getFormulationCategory(label: string) {
  const lower = String(label || "").toLowerCase();
  if (lower.includes("gota")) return "Gotas";
  if (lower.includes("susp") || lower.includes("xarope")) return "Xarope";
  return "Comprimido";
}

function formatFormulationLabel(label: string) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const normalizedCategory = getFormulationCategory(raw).toLowerCase();
  if (lower.startsWith("gota ")) {
    return `${raw.slice(5).trim()} (${normalizedCategory})`;
  }
  if (lower.startsWith("susp ")) {
    return `${raw.slice(5).trim()} (${normalizedCategory})`;
  }
  if (lower.startsWith("xarope ")) {
    return `${raw.slice(7).trim()} (${normalizedCategory})`;
  }
  return `${raw} (${normalizedCategory})`;
}

function getItemPresentationLabel(item: RxItem) {
  const primaryFormulation = item.peds?.formulations?.[0]?.label;
  if (primaryFormulation) {
    return formatFormulationLabel(primaryFormulation);
  }
  const match = item.label.match(/\(([^)]+)\)/);
  if (match?.[1]) return match[1];
  return item.label;
}

function getTemplateHmaItems(template: Template) {
  if (!Array.isArray(template.defaults.hmaItems)) return [];
  return template.defaults.hmaItems.map((item, idx) => {
    const rawLabel = item.label && item.label.trim().length ? item.label : shortenLabel(item.text || `HMA ${idx + 1}`);
    const label = normalizeHmaLabel(rawLabel);
    return { ...item, label };
  });
}

function getTemplateHmaDefaultStates(template: Template): HmaStateMap {
  const defaults = Array.isArray(template.defaults.hmaDefaults) ? template.defaults.hmaDefaults : [];
  const defaultSet = new Set(defaults);
  const items = getTemplateHmaItems(template);
  const states: HmaStateMap = {};
  const hasDefaults = defaultSet.size > 0;
  for (const item of items) {
    states[item.id] = hasDefaults ? (defaultSet.has(item.id) ? "presente" : "unknown") : "presente";
  }
  return states;
}

function buildTemplateDefaults(template: Template): TemplateState {
  return {
    qpText: getTemplateQP(template),
    alarme: template.defaults.alarme,
    comorb: template.defaults.comorb,
    meds: template.defaults.meds,
    alergiaNega: true,
    alergiaTexto: "",
    hipotese: template.defaults.hipotese ?? (template.label as string) ?? ((template as any).title ?? ""),
    condutaAlarmes: template.defaults.condutaAlarmes ?? "Retorno imediato se sinais de alarme ou piora do quadro",
    alarmStates: buildDefaultAlarmStates(template),
    rxSelected: template.defaults.rxDefaults ?? [],
    rxFormulationByItem: {},
    rxRegimenByItem: {},
    triagem: true,
    pa: "",
    fc: "",
    sat: "",
    tax: "",
    comorbSelected: [],
    atestadoEmitir: true,
    atestadoDias: 1,
    atestadoCid: "",
    exameLivre: ""
  };
}



import templatesData from "../templates/templates.json";
import rxCatalogData from "../prescriptions/catalog.json";
import rxGroupsData from "../prescriptions/groups.json";
import { getBetaAccessValidationError } from "../lib/betaAccessForm";
import {
  getProfileContextLabel,
  getProfileDisplayName,
  getProfileSegmentStyle,
  getProfileSwitchFeedback,
  PROFILE_UI_TOKENS
} from "../lib/profileUi";
import { buildWorkspaceContextBadges } from "../lib/workspaceUi";
const TEMPLATES = ((templatesData as { templates: Template[] }).templates ?? []).slice().sort((a, b) => a.label.localeCompare(b.label, "pt", { sensitivity: "base" }));
const INITIAL_TEMPLATE = TEMPLATES[0];
const INITIAL_DEFAULTS = INITIAL_TEMPLATE ? buildTemplateDefaults(INITIAL_TEMPLATE) : null;
const RX_CATALOG = (rxCatalogData as { items: RxItem[] }).items;
const RX_GROUPS = (rxGroupsData as { groups: RxGroup[] }).groups;
const RX_CATALOG_MAP_BASE: Record<string, RxItem> = Object.fromEntries(RX_CATALOG.map((item) => [item.id, item]));
const RX_GROUP_MAP: Record<string, RxGroup> = Object.fromEntries(RX_GROUPS.map((group) => [group.id, group]));
const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL;
const COMORB_OPTIONS = [
  { id: "HAS", label: "Hipertensão arterial sistêmica", abbr: "HAS" },
  { id: "DM2", label: "Diabetes mellitus tipo 2", abbr: "DM2" },
  { id: "DLP", label: "Dislipidemia", abbr: "DLP" },
  { id: "Asma", label: "Asma", abbr: "Asma" },
  { id: "DPOC", label: "DPOC", abbr: "DPOC" },
  { id: "ICC", label: "Insuficiência cardíaca", abbr: "ICC" },
  { id: "DAC", label: "Doença arterial coronariana", abbr: "DAC" },
  { id: "IRC", label: "Doença renal crônica", abbr: "IRC" },
  { id: "Hipotireoidismo", label: "Hipotireoidismo", abbr: "Hipotireoidismo" },
  { id: "Obesidade", label: "Obesidade", abbr: "Obesidade" },
  { id: "Tabagismo", label: "Tabagismo", abbr: "Tabagismo" },
  { id: "Gestante", label: "Gestante", abbr: "Gestante" },
  { id: "Imunossupressao", label: "Imunossupressão", abbr: "Imunossupressão" }
];

// AUTO_CID_HELPER
const normalizeCidKey = (s: string) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const cidFromKey = (keyRaw: string): string => {
  const key = normalizeCidKey(keyRaw);

  if (key.includes("bronquite")) return "J20.9";
  if (key.includes("sindrome gripal") || key.includes("gripe") || key.includes("influenza")) return "J11.1";
  if (key.includes("resfriado") || key.includes("coriza")) return "J00";
  if (key.includes("tosse") && (key.includes("pos") || key.includes("pós") || key.includes("viral"))) return "R05";
  if (key.includes("asma")) return "J45.9";
  if (key.includes("status") || key.includes("grave")) return "J46";
  if (key.includes("cistite")) return "N30.0";
  if (key.includes("dispepsia") || key.includes("epigastr")) return "K30";
  if (key.includes("gastroenterite") || key.includes("diarreia")) return "K52.9";
  if (key.includes("sinusite")) return "J01.9";
  if (key.includes("conjuntiv")) return "H10.3";
  if (key.includes("pneumon")) return "J18.9";
  if (key.includes("dengue") || key.includes("arbov")) return "A90";
  if (key.includes("escab")) return "B86";
  if (key.includes("abscesso") || key.includes("furunc")) return "L02.9";
  if (key.includes("rinite")) return "J30.4";
  if (key.includes("candid")) return "B37.3";
  if (key.includes("laring") || key.includes("disfon")) return "J04.0";
  if (key.includes("tensional")) return "G44.2";
  if (key.includes("enxaqu")) return "G43.9";
  if (key.includes("celulite")) return "L03.9";
  if (key.includes("erisipel")) return "A46";

  if (key.includes("faringo") || key.includes("amigdal")) {
    if (key.includes("bacter") || key.includes("estrept")) return "J03.0";
    return "J02.9";
  }

  if (key.includes("lomb")) return "M54.5";

  return "";
};

const getTemplateAutoCid = (templateId: string): string => {
  const list = (templatesData as any)?.templates ?? (templatesData as any);
  if (!Array.isArray(list)) return "";
  const tpl = list.find(
    (t: any) => t?.id === templateId || t?.templateId === templateId || t?.slug === templateId || t?.title === templateId || t?.name === templateId
  );
  const key = `${tpl?.id ?? ""} ${tpl?.title ?? ""} ${tpl?.name ?? ""}`;
  if (key.toLowerCase().includes("urtic")) return "L50.9";
  return cidFromKey(key);
};


export default function Page() {
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]?.id ?? "lombalgia");
  const router = useRouter();
  const pathname = usePathname();
  const feedbackUrl = FEEDBACK_URL;

  const validateBeta = async () => {
    const code = betaInput.trim();
    const email = betaEmail.trim().toLowerCase();
    const validationError = getBetaAccessValidationError(code, email);
    if (validationError) {
      setBetaError(validationError);
      return;
    }

    setBetaError("");
    setBetaLoading(true);
    try {
      const res = await fetch("/api/beta/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email })
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setBetaOk(true);
        setBetaLabel(json.label);
        localStorage.setItem(BETA_STORAGE_KEY, JSON.stringify({ code, emailHash: json.emailHash, ts: Date.now() }));
        const cleanName = betaNameInput.trim();
        if (cleanName) {
          localStorage.setItem("beta_display_name", cleanName);
          setBetaDisplayName(cleanName);
        }
        if (rememberDevice) {
          localStorage.setItem("beta_remember_ok", "1");
          localStorage.setItem("beta_remember_until", String(Date.now() + 24 * 60 * 60 * 1000));
        } else {
          localStorage.removeItem("beta_remember_ok");
          localStorage.removeItem("beta_remember_until");
        }
      } else {
        localStorage.removeItem(BETA_STORAGE_KEY);
        setBetaError(json.reason || "invalid");
        setBetaOk(false);
      }
    } catch (err) {
      setBetaError("invalid");
      setBetaOk(false);
    } finally {
      setBetaLoading(false);
    }
  };
  const [qpText, setQpText] = useState("");
  const [alarme, setAlarme] = useState("Nega perda de força, anestesia em sela e alteração esfincteriana");
  const [comorb, setComorb] = useState("DM NIR, HAS");
  const [meds, setMeds] = useState("Metformina 500mg 1-0-1 + Losartana 50mg 1-0-1");
  const [alergiaNega, setAlergiaNega] = useState(true);
  const [alergiaTexto, setAlergiaTexto] = useState("");
  const [alarmStates, setAlarmStates] = useState<AlarmStateMap>({});
  const [rxSelected, setRxSelected] = useState<string[]>([]);
  const [rxFormulationByItem, setRxFormulationByItem] = useState<Record<string, string>>({});
  const [rxRegimenByItem, setRxRegimenByItem] = useState<Record<string, string>>({});
  const [hmaStates, setHmaStates] = useState<HmaStateMap>({});
  const [hmaFreeText, setHmaFreeText] = useState("");
  const [hmaFreeOpen, setHmaFreeOpen] = useState(false);
  const [atestadoEmitir, setAtestadoEmitir] = useState(true);
  const [atestadoDias, setAtestadoDias] = useState(1);
  const [atestadoCid, setAtestadoCid] = useState("");
  const [exameLivre, setExameLivre] = useState("");
  const [triagem, setTriagem] = useState(true);
  const [pa, setPa] = useState("");
  const [fc, setFc] = useState("");
  const [sat, setSat] = useState("");
  const [tax, setTax] = useState("");
  const [includeRx, setIncludeRx] = useState(false);
  const [comorbSelected, setComorbSelected] = useState<string[]>([]);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [privacyCheckbox, setPrivacyCheckbox] = useState(false);
  const [betaOk, setBetaOk] = useState(false);
  const [betaLabel, setBetaLabel] = useState<string>("");
  const [betaInput, setBetaInput] = useState("");
  const [betaEmail, setBetaEmail] = useState("");
  const [betaNameInput, setBetaNameInput] = useState("");
  const [betaDisplayName, setBetaDisplayName] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [betaError, setBetaError] = useState<string>("");
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaHydrating, setBetaHydrating] = useState(true);
  const [betaToast, setBetaToast] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [profile, setProfile] = useState<"adulto" | "pediatria">("adulto");
  const [patientAge, setPatientAge] = useState<string>("");
  const [patientWeight, setPatientWeight] = useState<string>("");
  const [profileSwitchFeedback, setProfileSwitchFeedback] = useState("");
  const availableTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => isTemplateIdCompatibleWithProfile(t.id, profile));
  }, [profile]);
  const currentTemplate = useMemo(() => {
    const match = availableTemplates.find((t) => t.id === templateId);
    return match ?? availableTemplates[0] ?? null;
  }, [templateId, availableTemplates]);
  const didHydrate = useRef(false);
  const urlPrefillDone = useRef(false);
  const autoActivateTried = useRef(false);
  const isApplyingTemplate = useRef(false);
  const savedTemplatesRef = useRef<Record<string, Partial<TemplateState>>>({});
  const rxKitsRef = useRef<Record<string, string[]>>({});
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const catalogForProfile = useMemo(
    () => RX_CATALOG.filter((item) => (profile === "pediatria" ? true : !item.peds)),
    [profile]
  );
  const catalogMap = useMemo(() => Object.fromEntries(catalogForProfile.map((item) => [item.id, item])), [catalogForProfile]);
  const ageInfo = useMemo(() => parseAgeMonths(patientAge), [patientAge]);
  const weightKg = useMemo(() => parseWeightKg(patientWeight), [patientWeight]);
  const getItemDirectionsForDisplay = useMemo(
    () =>
      (item: RxItem) =>
        getRxDirections(item, profile, weightKg, ageInfo.months, rxFormulationByItem[item.id], rxRegimenByItem[item.id]),
    [profile, weightKg, ageInfo.months, rxFormulationByItem, rxRegimenByItem]
  );
  const getSelectedFormulationLabel = useMemo(
    () => (item: RxItem) => {
      const options = item.peds?.formulations ?? [];
      if (!options.length) return "";
      const selected = rxFormulationByItem[item.id];
      if (selected && options.some((opt) => opt.label === selected)) return selected;
      return options[0].label;
    },
    [rxFormulationByItem]
  );
  const getMedicationDisplayTitle = useMemo(
    () => (item: RxItem) => {
      const base = item.title;
      const formulation = formatFormulationLabel(getSelectedFormulationLabel(item));
      const withFormulation = formulation ? `${base} ${formulation}` : base;
      return item.brand ? `${withFormulation} (${item.brand})` : withFormulation;
    },
    [getSelectedFormulationLabel]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!urlPrefillDone.current) {
      const url = new URL(window.location.href);
      const codeFromUrl = url.searchParams.get("code") ?? "";
      const emailFromUrl = url.searchParams.get("email") ?? "";
      const adminFromUrl = url.searchParams.get("admin") ?? "";

      if (codeFromUrl && !betaInput) {
        setBetaInput(codeFromUrl);
      }
      if (emailFromUrl && !betaEmail) {
        setBetaEmail(emailFromUrl);
      }
      if (codeFromUrl && !emailFromUrl && emailInputRef.current) {
        emailInputRef.current.focus();
      }
      if (adminFromUrl) {
        setIsAdminMode(adminFromUrl === "1" || adminFromUrl.toLowerCase() === "true");
      }
      urlPrefillDone.current = true;
    }

    let cancelled = false;

    const hydrate = async () => {
      setBetaHydrating(true);
      try {
        const legacyBeta = localStorage.getItem(LEGACY_BETA_STORAGE_KEY);
        if (legacyBeta) {
          localStorage.removeItem(LEGACY_BETA_STORAGE_KEY);
        }

        const storedBeta = localStorage.getItem(BETA_STORAGE_KEY);
        if (storedBeta) {
          try {
            const parsed = JSON.parse(storedBeta) as { code?: string; emailHash?: string };
            if (parsed?.code && parsed?.emailHash) {
              const res = await fetch("/api/beta/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: parsed.code, emailHash: parsed.emailHash })
              });
              const json = await res.json();
              if (cancelled) return;
              if (res.ok && json.ok) {
                setBetaOk(true);
                setBetaLabel(json.label);
              } else {
                localStorage.removeItem(BETA_STORAGE_KEY);
                setBetaOk(false);
                setBetaError(json.reason || "invalid");
              }
            } else {
              localStorage.removeItem(BETA_STORAGE_KEY);
            }
          } catch (err) {
            if (!cancelled) {
              localStorage.removeItem(BETA_STORAGE_KEY);
              setBetaError("invalid");
            }
          }
        }

        try {
          const rememberOk = localStorage.getItem("beta_remember_ok") === "1";
          const rememberUntilRaw = localStorage.getItem("beta_remember_until");
          const rememberUntil = rememberUntilRaw ? Number(rememberUntilRaw) : 0;
          if (rememberOk && rememberUntil > Date.now()) {
            setBetaOk(true);
          } else if (rememberUntilRaw) {
            localStorage.removeItem("beta_remember_ok");
            localStorage.removeItem("beta_remember_until");
          }
        } catch (err) {
          console.error("Falha ao ler remember device", err);
        }

        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw
          ? (JSON.parse(raw) as { templateId?: string; templates?: Record<string, TemplateState>; rxKits?: Record<string, string[]> })
          : {};
        savedTemplatesRef.current = parsed.templates ?? {};
        rxKitsRef.current = parsed.rxKits ?? {};

        const storedTemplateId =
          parsed.templateId && TEMPLATES.some((t) => t.id === parsed.templateId) ? parsed.templateId : TEMPLATES[0]?.id;
        if (storedTemplateId) {
          setTemplateId(storedTemplateId);
        }

        const savedName = localStorage.getItem("beta_display_name");
        if (savedName) {
          setBetaDisplayName(savedName);
        }

        const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (storedProfile === "pediatria" || storedProfile === "adulto") {
          setProfile(storedProfile);
        }
        const storedAge = localStorage.getItem("patient_age");
        const storedWeight = localStorage.getItem("patient_weight");
        if (storedAge) setPatientAge(storedAge);
        if (storedWeight) setPatientWeight(storedWeight);
      } catch (err) {
        console.error("Falha ao carregar estado local:", err);
      } finally {
        if (!cancelled) {
          didHydrate.current = true;
          setBetaHydrating(false);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ack = localStorage.getItem(PRIVACY_KEY);
    if (ack === "1") {
      setPrivacyAck(true);
      setPrivacyCheckbox(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, profile);
      localStorage.setItem("patient_age", patientAge);
      localStorage.setItem("patient_weight", patientWeight);
    } catch (err) {
      console.error("Erro ao salvar perfil do paciente", err);
    }
  }, [profile, patientAge, patientWeight]);

  useEffect(() => {
    if (!availableTemplates.length) {
      setTemplateId("");
      return;
    }
    if (!availableTemplates.some((t) => t.id === templateId)) {
      setTemplateId(availableTemplates[0].id);
    }
  }, [availableTemplates, templateId]);

  useEffect(() => {
    return () => {
      clearBetaToast();
      clearProfileSwitchFeedback();
    };
  }, []);

  useEffect(() => {
    if (betaOk || betaLoading || betaHydrating) return;
    if (!betaInput.trim() || !betaEmail.trim()) return;
    if (autoActivateTried.current) return;

    autoActivateTried.current = true;
    validateBeta();
  }, [betaOk, betaLoading, betaHydrating, betaInput, betaEmail]);

  useEffect(() => {
    if (!currentTemplate || !didHydrate.current) return;
    const savedState = savedTemplatesRef.current[templateId];
    const templateState = { ...buildTemplateDefaults(currentTemplate), ...savedState };

    isApplyingTemplate.current = true;
    setQpText(templateState.qpText ?? "");
    let selectedFromStorage: HmaStateMap | undefined;
    let freeFromStorage = "";
    if (typeof window !== "undefined") {
      try {
        const storedSelected = localStorage.getItem(`${HMA_SELECTED_PREFIX}${templateId}`);
        if (storedSelected) {
          const parsed = JSON.parse(storedSelected);
          if (Array.isArray(parsed)) {
            selectedFromStorage = {};
            parsed.filter((v: unknown) => typeof v === "string").forEach((id: string) => (selectedFromStorage![id] = "presente"));
          } else if (parsed && typeof parsed === "object") {
            const map: HmaStateMap = {};
            Object.entries(parsed as Record<string, string>).forEach(([key, val]) => {
              const v = val === "presente" || val === "nega" || val === "unknown" ? val : "unknown";
              map[key] = v;
            });
            selectedFromStorage = map;
          }
        }
        const storedFree = localStorage.getItem(`${HMA_FREE_PREFIX}${templateId}`);
        if (typeof storedFree === "string") {
          freeFromStorage = storedFree;
        }
      } catch (err) {
        console.error("Erro ao carregar HMA do storage", err);
      }
    }
    const defaultsHma = getTemplateHmaDefaultStates(currentTemplate);
    const mergedHmaStates = selectedFromStorage && Object.keys(selectedFromStorage).length ? selectedFromStorage : defaultsHma;
    setHmaStates(mergedHmaStates);
    setHmaFreeText(freeFromStorage || "");
    setHmaFreeOpen(Boolean(freeFromStorage && freeFromStorage.trim().length));
    setAlarme(templateState.alarme);
    setComorb(templateState.comorb);
    setMeds(templateState.meds);
    setHipotese(templateState.hipotese);
    setCondutaAlarmes(templateState.condutaAlarmes);
    const defaultAlarms = buildDefaultAlarmStates(currentTemplate);
    const savedAlarms = templateState.alarmStates ?? {};
    setAlarmStates({ ...defaultAlarms, ...savedAlarms });
    setTriagem(templateState.triagem ?? true);
    setPa(templateState.pa ?? "");
    setFc(templateState.fc ?? "");
    setSat(templateState.sat ?? "");
    setTax(templateState.tax ?? "");
    setComorbSelected(templateState.comorbSelected ?? []);
    setAtestadoEmitir(templateState.atestadoEmitir ?? true);
    setAtestadoDias(templateState.atestadoDias ?? 1);
    setAtestadoCid(templateState.atestadoCid ?? "");
    setExameLivre(templateState.exameLivre ?? "");
    setAlergiaNega(templateState.alergiaNega ?? true);
    setAlergiaTexto(templateState.alergiaTexto ?? "");
    const kit = rxKitsRef.current[templateId];
    setRxSelected(kit ?? currentTemplate.defaults.rxDefaults ?? []);
    setRxFormulationByItem(templateState.rxFormulationByItem ?? {});
    setRxRegimenByItem(templateState.rxRegimenByItem ?? {});
    isApplyingTemplate.current = false;
  }, [templateId, currentTemplate]);

  // AUTO_CID_EFFECT
  useEffect(() => {
    const d = getTemplateAutoCid(templateId);
    if (d) setAtestadoCid(d);
  }, [templateId]);

  const [hipotese, setHipotese] = useState(INITIAL_DEFAULTS?.hipotese ?? (INITIAL_TEMPLATE?.label ?? ""));
  const [condutaAlarmes, setCondutaAlarmes] = useState(INITIAL_DEFAULTS?.condutaAlarmes ?? "Retorno imediato se sinais de alarme ou piora do quadro");
  useEffect(() => {
    if (!didHydrate.current || isApplyingTemplate.current) return;

    const currentState: TemplateState = {
      qpText,
      alarme,
      comorb,
      meds,
      alergiaNega,
      alergiaTexto,
      hipotese,
      condutaAlarmes,
      alarmStates,
      rxSelected,
      rxFormulationByItem,
      rxRegimenByItem,
      triagem,
      pa,
      fc,
      sat,
      tax,
      comorbSelected,
      atestadoEmitir,
      atestadoDias,
      atestadoCid,
      exameLivre
    };

    savedTemplatesRef.current = { ...savedTemplatesRef.current, [templateId]: currentState };

    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          templateId,
          templates: savedTemplatesRef.current,
          rxKits: rxKitsRef.current
        })
      );
    }
  }, [
    templateId,
    qpText,
    alarme,
    comorb,
    meds,
    alergiaNega,
    alergiaTexto,
    hipotese,
    condutaAlarmes,
    alarmStates,
    rxSelected,
    rxFormulationByItem,
    rxRegimenByItem,
    triagem,
    pa,
    fc,
    sat,
    tax,
    comorbSelected,
    atestadoEmitir,
    atestadoDias,
    atestadoCid,
    exameLivre
  ]);

  useEffect(() => {
    if (!didHydrate.current || isApplyingTemplate.current) return;
    if (typeof window === "undefined") return;
    try {
    localStorage.setItem(`${HMA_SELECTED_PREFIX}${templateId}`, JSON.stringify(hmaStates));
    localStorage.setItem(`${HMA_FREE_PREFIX}${templateId}`, hmaFreeText);
  } catch (err) {
    console.error("Erro ao salvar HMA", err);
  }
  }, [hmaStates, hmaFreeText, templateId]);

  const alarmCount = currentTemplate ? (currentTemplate.defaults.alarmItems ?? []).length : 0;
  const hasAlarmItems = alarmCount > 0;
  const alarmLines = useMemo(() => {
    if (!currentTemplate) return [];
    const items = currentTemplate.defaults.alarmItems ?? [];
    if (!items.length) return [];

    const ausentes: string[] = [];
    const presentes: string[] = [];
    for (const item of items) {
      const status = alarmStates[item.id] ?? "unknown";
      if (status === "nega") {
        const lbl = alarmLabelForPrint(item.absentLabel ?? item.label ?? "");
        if (lbl) ausentes.push(lbl);
      }
      if (status === "presente") {
        const lbl = alarmLabelForPrint(item.presentText || item.label || "");
        if (lbl) presentes.push(lbl);
      }
    }

    const lines: string[] = [];
    if (ausentes.length) lines.push(`Ausência de: ${ausentes.join(", ")}`);
    if (presentes.length) lines.push(`Sinais de alarme presentes: ${presentes.join(", ")}`);
    return lines;
  }, [alarme, alarmStates, currentTemplate]);
  const templateRxGroups = useMemo(() => {
    if (!currentTemplate) return [];
    return (currentTemplate.defaults.rxGroups ?? []).map((id) => RX_GROUP_MAP[id] ?? { id, label: id, itemIds: [] });
  }, [currentTemplate]);
  const rxSelectionOptionsByGroup = useMemo(() => {
    const grouped: Record<string, RxSelectionOption[]> = {};
    for (const group of templateRxGroups) {
      const opts: RxSelectionOption[] = [];
      const familyIndex = new Map<string, number>();
      for (const itemId of group.itemIds ?? []) {
        const item = catalogMap[itemId];
        if (!item) continue;
        const familyKey = profile === "pediatria" ? `${item.title}|${item.route}` : item.id;
        const existingIdx = familyIndex.get(familyKey);
        if (existingIdx === undefined) {
          familyIndex.set(familyKey, opts.length);
          opts.push({
            key: familyKey,
            title: item.title,
            route: item.route,
            itemIds: [itemId]
          });
        } else {
          opts[existingIdx].itemIds.push(itemId);
        }
      }
      grouped[group.id] = opts;
    }
    return grouped;
  }, [templateRxGroups, catalogMap, profile]);
  const prescribedClasses = useMemo(() => {
    if (!rxSelected.length) return [];
    const sel = new Set(rxSelected);
    const classes: string[] = [];
    for (const group of templateRxGroups) {
      if (!group?.itemIds?.length) continue;
      if (group.itemIds.some((itemId) => sel.has(itemId))) {
        const label = group.label || group.id;
        if (label && !classes.includes(label)) classes.push(label);
      }
    }
    return classes;
  }, [rxSelected, templateRxGroups]);
  const prescribedClassesDisplay = useMemo(() => {
    const lower = prescribedClasses.map((c) => (c || "").toLowerCase());
    if (lower.length === 1) {
      const only = lower[0];
      const singular = only.endsWith("s") ? only.replace(/s\b/, "") : only;
      return [singular];
    }
    return lower;
  }, [prescribedClasses]);
  const extraOrientations = useMemo(() => {
    if (templateId !== "escabiose") return [];
    return [
      "Orientações gerais para ambiente e roupas: trocar roupa de cama e vestimentas usadas nos últimos dias, lavando em água mais quente quando possível.",
      "Secar peças ao sol e finalizar com ferro quente para auxiliar na eliminação do agente."
    ];
  }, [templateId]);
  const orderedSelectedRxIds = useMemo(() => {
    const selectedSet = new Set(rxSelected);
    const ordered: string[] = [];
    const seen = new Set<string>();

    if (currentTemplate) {
      for (const groupId of currentTemplate.defaults.rxGroups ?? []) {
        const group = RX_GROUP_MAP[groupId];
        if (!group?.itemIds) continue;
        for (const itemId of group.itemIds) {
          if (selectedSet.has(itemId) && !seen.has(itemId)) {
            ordered.push(itemId);
            seen.add(itemId);
          }
        }
      }
    }

    for (const id of rxSelected) {
      if (!seen.has(id)) {
        ordered.push(id);
        seen.add(id);
      }
    }

    return ordered;
  }, [rxSelected, currentTemplate]);
  const groupedRx = useMemo(() => {
    const byRoute: Record<string, RxItem[]> = {};
    for (const id of orderedSelectedRxIds) {
      const item = catalogMap[id];
      if (!item) continue;
      const route = (item.route || "OUTROS").toUpperCase();
      if (!byRoute[route]) byRoute[route] = [];
      byRoute[route].push(item);
    }
    const orderIndex = (route: string) => {
      const idx = RX_ROUTE_ORDER.indexOf(route);
      return idx === -1 ? RX_ROUTE_ORDER.length + 1 : idx;
    };
    return Object.entries(byRoute)
      .sort(([a], [b]) => orderIndex(a) - orderIndex(b) || a.localeCompare(b, "pt"))
      .map(([route, items]) => ({ route, items }));
  }, [orderedSelectedRxIds, catalogMap]);
  const rxText = useMemo(() => {
    if (!orderedSelectedRxIds.length) return "";
    const byRoute: Record<string, RxItem[]> = {};

    for (const id of orderedSelectedRxIds) {
      const item = catalogMap[id];
      if (!item) continue;
      const route = (item.route || "OUTROS").toUpperCase();
      if (!byRoute[route]) byRoute[route] = [];
      byRoute[route].push(item);
    }

    const orderIndex = (route: string) => {
      const idx = RX_ROUTE_ORDER.indexOf(route);
      return idx === -1 ? RX_ROUTE_ORDER.length + 1 : idx;
    };

    const routeBlocks = Object.entries(byRoute)
      .sort(([a], [b]) => orderIndex(a) - orderIndex(b) || a.localeCompare(b, "pt"))
      .map(([route, items]) => {
        const lines: string[] = [`USO ${route}:`];
        items.forEach((item, index) => {
          const titleBrand = getMedicationDisplayTitle(item);
          const base = `${index + 1}. ${titleBrand}`;
          const dotsWidth = Math.max(2, 80 - base.length - item.qty.length - 2);
          const dotted = `${base} ${".".repeat(dotsWidth)} ${item.qty}`;
          lines.push(dotted);
          getItemDirectionsForDisplay(item).forEach((dir) => {
            if (dir.trim()) lines.push(dir.trim());
          });
          if (index < items.length - 1) {
            lines.push("");
          }
        });
        return lines.join("\n").trim();
      });

    return routeBlocks.join("\n\n").trim();
  }, [orderedSelectedRxIds, catalogMap, getItemDirectionsForDisplay, getMedicationDisplayTitle]);
  
  const hmaParagraphs = useMemo(() => {
    if (!currentTemplate) return [];
    const items = getTemplateHmaItems(currentTemplate);
    const presentLabels = items
      .filter((it) => hmaStates[it.id] === "presente")
      .map((it) => (it.label || "").trim().toLowerCase())
      .filter(Boolean);
    const negLabels = items
      .filter((it) => hmaStates[it.id] === "nega")
      .map((it) => (it.label || "").trim().toLowerCase())
      .filter(Boolean);

    const freeParagraph = hmaFreeText
      ? formatParagraph(
          hmaFreeText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        )
      : "";

    const paragraphs = [];
    const presentNarrative = buildPresentNarrative(presentLabels);
    if (presentNarrative) paragraphs.push(presentNarrative);
    if (negLabels.length) paragraphs.push(formatParagraph([`Nega ${formatList(negLabels)}`]));
    if (freeParagraph) paragraphs.push(freeParagraph);
    return paragraphs;
  }, [hmaStates, hmaFreeText, currentTemplate]);
  const hmaPresentCount = useMemo(() => Object.values(hmaStates).filter((s) => s === "presente").length, [hmaStates]);
  const hmaNegCount = useMemo(() => Object.values(hmaStates).filter((s) => s === "nega").length, [hmaStates]);
  const pediatricIntro = useMemo(() => {
    if (profile !== "pediatria") return "";
    if (!currentTemplate) return "";
    const months = ageInfo.months;
    let faixa = "paciente";
    if (months !== null) {
      if (months < 1) faixa = "recém-nascido";
      else if (months < 24) faixa = "lactente";
      else if (months < 144) faixa = "escolar";
      else faixa = "adolescente";
    }
    const agePart = ageInfo.display ? `${ageInfo.display}` : "";
    const weightClean = patientWeight.trim();
    const weightPart = weightClean ? (/\bkg\b/i.test(weightClean) ? weightClean : `${weightClean} kg`) : "";
    const qpRaw = (qpText.trim() || getTemplateQP(currentTemplate) || currentTemplate.label || "queixa principal").replace(/\.$/, "");
    const qpDisplay = qpRaw.charAt(0).toLowerCase() + qpRaw.slice(1);
    const pieces = [`Paciente ${faixa}`];
    if (agePart) pieces.push(agePart);
    if (weightPart) pieces.push(weightPart);
    const prefix = pieces.join(", ");
    return `${prefix}, trazido por familiar, com queixa de ${qpDisplay}.`;
  }, [profile, ageInfo, patientWeight, qpText, currentTemplate]);

  const blocks = useMemo(() => {
    if (!currentTemplate) {
      return { anamnese: [], exame: [], hipotese: [], conduta: [] };
    }
    const templateLabel = currentTemplate.label ?? (currentTemplate as any).title ?? "";
    const anamnese = [
      pediatricIntro ? pediatricIntro : qpText ? `QP: ${qpText}` : templateLabel ? `QP: ${templateLabel}` : "QP: __",
      hmaParagraphs.length ? hmaParagraphs[0] : "",
      ...(hmaParagraphs.slice(1).length ? ["", ...hmaParagraphs.slice(1)] : []),
      ...alarmLines,
      (() => {
        const selectedAbbrs = COMORB_OPTIONS.filter((c) => comorbSelected.includes(c.id)).map((c) => c.label);
        const manual = comorb ? [comorb] : [];
        const combined = [...selectedAbbrs, ...manual].filter(Boolean);
        if (!combined.length) return "Nega comorbidades relevantes";
        return `Comorbidades: ${combined.join(", ")}`;
      })(),
      meds ? `Medicações de uso contínuo: ${meds}` : "",
      alergiaNega ? "Nega alergias" : alergiaTexto ? `Alergias: ${alergiaTexto}` : "Relata alergias (especificar)."
    ].filter(Boolean);

  const vitalsLine = !triagem && (pa || fc || sat || tax)
    ? `PA ${pa || "___"} mmHg | FC ${fc || "___"} bpm | SatO2 ${sat || "___"}%${tax ? ` | Tax ${tax} °C` : ""}`
    : "";

    const exameRaw = currentTemplate.defaults.exame ?? [];
    const exameBase = Array.isArray(exameRaw) ? exameRaw : exameRaw ? [exameRaw] : [];
    const dedupedExameBase =
      vitalsLine && exameBase.length
        ? exameBase.filter((line, idx) => !(idx === 0 && line.trim().toLowerCase() === vitalsLine.trim().toLowerCase()))
        : exameBase;
    const extraExame: string[] = [];
    if (hmaStates["picada-inseto"] === "presente") {
      extraExame.push("Pele: estigmas de picada/lesões compatíveis com estrófulo em áreas expostas.");
    }
    if (hmaStates["angioedema"] === "presente") {
      extraExame.push("Edema visível em lábios/pálpebras compatível com angioedema.");
    }

    const exameLivreLinhas = exameLivre
      ? exameLivre
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      : [];

    const exame = [vitalsLine, ...dedupedExameBase, ...extraExame, ...exameLivreLinhas].filter(Boolean);

    const avaliacao = [hipotese].filter(Boolean);

    const conduta = [
      prescribedClassesDisplay.length ? `Prescrevo ${formatList(prescribedClassesDisplay)}` : "",
      "Orientado sobre o quadro e conduta",
      "Oriento sinais de alarme e retorno imediato, se necessário.",
      "Paciente esclarecido e de acordo com as orientações"
    ]
      .concat(extraOrientations)
      .filter(Boolean);

    if (atestadoEmitir) {
      const dias = Number.isFinite(atestadoDias) ? atestadoDias : 1;
      const plural = dias === 1 ? "dia" : "dias";
      const cidText = atestadoCid?.trim() ? atestadoCid.trim() : "____";
      conduta.push(`Emitido atestado médico (${dias} ${plural}) (CID: ${cidText})`);
    }

    return { anamnese, exame, hipotese: avaliacao, conduta };
  }, [
    qpText,
    hmaParagraphs,
    alarmLines,
    comorb,
    comorbSelected,
    meds,
    pediatricIntro,
    alergiaNega,
    triagem,
    pa,
    fc,
    sat,
    tax,
    hmaStates,
    hipotese,
    condutaAlarmes,
    currentTemplate,
    templateId,
    exameLivre,
    atestadoEmitir,
    atestadoDias,
    atestadoCid,
    prescribedClassesDisplay
  ]);

  function formatBlock(key: BlockKey) {
    return blocks[key].join("\n");
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  const clearBetaToast = () => {
    if (betaToastTimeout.current) {
      clearTimeout(betaToastTimeout.current);
      betaToastTimeout.current = undefined;
    }
  };
  const clearProfileSwitchFeedback = () => {
    if (profileSwitchFeedbackTimeout.current) {
      clearTimeout(profileSwitchFeedbackTimeout.current);
      profileSwitchFeedbackTimeout.current = undefined;
    }
  };

  const betaToastTimeout = useRef<number | undefined>(undefined);
  const profileSwitchFeedbackTimeout = useRef<number | undefined>(undefined);

  function handleProfileChange(nextProfile: "adulto" | "pediatria") {
    setTemplateId((prev) => (isTemplateIdCompatibleWithProfile(prev, nextProfile) ? prev : ""));
    if (profile !== nextProfile) {
      setProfileSwitchFeedback(getProfileSwitchFeedback(nextProfile));
      clearProfileSwitchFeedback();
      profileSwitchFeedbackTimeout.current = window.setTimeout(() => setProfileSwitchFeedback(""), 1600);
    }
    setProfile(nextProfile);
  }

  async function handleCopyInviteLink() {
    const cleanCode = betaInput.trim();
    if (!cleanCode) {
      setBetaError("invalid");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?code=${encodeURIComponent(cleanCode)}`);
      clearBetaToast();
      setBetaToast("copiado");
      betaToastTimeout.current = window.setTimeout(() => setBetaToast(""), 2000);
    } catch (err) {
      console.error("Erro ao copiar link de convite", err);
      setBetaError("invalid");
    }
  }

function handlePrivacyContinue() {
  setPrivacyAck(true);
  try {
    localStorage.setItem(PRIVACY_KEY, "1");
  } catch (err) {
    console.error("Erro ao salvar aviso de privacidade", err);
  }
}

  if (!betaOk) {
    const betaBusy = betaLoading || betaHydrating;
    return (
      <main className="workspace-main" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", fontFamily: "ui-sans-serif, system-ui" }}>
        <div
          className="workspace-panel"
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14
          }}
          aria-busy={betaBusy}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: "#2563eb", marginBottom: 6 }}>Acesso seguro</div>
            <h1 style={{ fontSize: 26, lineHeight: 1.2, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Identificação profissional</h1>
            <div style={{ fontSize: 14, color: "#475569", marginBottom: 6 }}>Valide seu código para liberar o workspace clínico.</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Use seu código institucional e e-mail profissional para autenticação.</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              Confiança: seus dados de acesso não são incluídos na evolução nem no receituário.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label htmlFor="beta-code-input" style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#1f2937" }}>
              Código de acesso
              <input
                id="beta-code-input"
                className="ux-focus-control ui-control"
                value={betaInput}
                onChange={(e) => setBetaInput(e.target.value)}
                placeholder="PLANTAO-XXXX-YYYY"
                disabled={betaBusy}
                autoComplete="one-time-code"
                spellCheck={false}
                aria-describedby="beta-access-trust"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", width: "100%" }}
              />
            </label>
            <label htmlFor="beta-email-input" style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#1f2937" }}>
              E-mail profissional
              <input
                id="beta-email-input"
                className="ux-focus-control ui-control"
                value={betaEmail}
                onChange={(e) => setBetaEmail(e.target.value)}
                placeholder="email@exemplo.com"
                disabled={betaBusy}
                ref={emailInputRef}
                autoComplete="email"
                inputMode="email"
                aria-describedby="beta-access-trust"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", width: "100%" }}
              />
            </label>
            <label htmlFor="beta-name-input" style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#1f2937" }}>
              Nome para identificação (opcional)
              <input
                id="beta-name-input"
                className="ux-focus-control ui-control"
                value={betaNameInput}
                onChange={(e) => setBetaNameInput(e.target.value)}
                placeholder="Seu nome"
                disabled={betaBusy}
                autoComplete="name"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", width: "100%" }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1f2937" }}>
              <input
                className="ux-focus-control"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                disabled={betaBusy}
              />
              lembrar neste dispositivo (24h)
            </label>
            <div id="beta-access-trust" style={{ fontSize: 12, color: "#6b7280" }}>Use esta opção apenas em dispositivo pessoal.</div>
          </div>
          <button
            type="button"
            className="ux-focus-control"
            onClick={validateBeta}
            disabled={betaBusy}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: betaBusy ? "#93c5fd" : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              cursor: betaBusy ? "not-allowed" : "pointer"
            }}
          >
            {betaBusy ? "Validando acesso..." : "Validar e entrar"}
          </button>
          {(isAdminMode || (betaLabel && betaLabel.toLowerCase() === "owner")) && (
            <button
              type="button"
              onClick={handleCopyInviteLink}
              disabled={betaBusy}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#2563eb",
                fontSize: 13,
                fontWeight: 600,
                cursor: betaBusy ? "not-allowed" : "pointer"
              }}
            >
              copiar link de convite
            </button>
          )}
          {betaHydrating && !betaError && (
            <div style={{ color: "#4b5563", fontSize: 13 }}>Validando acesso salvo...</div>
          )}
          {betaToast && (
            <div role="status" aria-live="polite" style={{ color: "#15803d", fontSize: 13 }}>
              {betaToast}
            </div>
          )}
          {betaOk && (
            <button
              type="button"
              onClick={() => {
                setBetaOk(false);
                setBetaLabel("");
                localStorage.removeItem(BETA_STORAGE_KEY);
                localStorage.removeItem("beta_remember_ok");
                localStorage.removeItem("beta_remember_until");
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#b91c1c",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              sair
            </button>
          )}
          {betaError && (
            <div role="alert" aria-live="assertive" style={{ color: "#b91c1c", fontSize: 13 }}>
              {betaError === "expired"
                ? "Código expirado."
                : betaError === "revoked"
                  ? "Código revogado."
                  : betaError === "invalid_email"
                    ? "Informe um e-mail válido."
                    : betaError === "bound_to_other_email"
                      ? "Este código já foi ativado com outro e-mail."
                      : betaError === "not_activated"
                        ? "Ative o código com seu e-mail para continuar."
                        : betaError === "kv_not_configured"
                          ? "Serviço de acesso indisponível no momento."
                          : "Não foi possível validar o acesso."}
            </div>
          )}
        </div>
      </main>
    );
  }

  function handleRestoreTemplateDefaults() {
    if (!currentTemplate) return;

    const defaults = buildTemplateDefaults(currentTemplate);
    isApplyingTemplate.current = true;
    setQpText(defaults.qpText);
    setHmaStates(getTemplateHmaDefaultStates(currentTemplate));
    setHmaFreeText("");
    setHmaFreeOpen(false);
    setAlarme(defaults.alarme);
    setComorb(defaults.comorb);
    setMeds(defaults.meds);
    setAlergiaNega(defaults.alergiaNega);
    setAlergiaTexto(defaults.alergiaTexto);
    setHipotese(defaults.hipotese);
    setCondutaAlarmes(defaults.condutaAlarmes);
    setAtestadoEmitir(defaults.atestadoEmitir ?? true);
    setAtestadoDias(defaults.atestadoDias ?? 1);
    setAtestadoCid(defaults.atestadoCid ?? "");
    setExameLivre(defaults.exameLivre ?? "");
    setAlarmStates(defaults.alarmStates);
    setRxSelected(defaults.rxSelected);
    setRxFormulationByItem(defaults.rxFormulationByItem ?? {});
    setRxRegimenByItem(defaults.rxRegimenByItem ?? {});
    setTriagem(defaults.triagem);
    setPa(defaults.pa);
    setFc(defaults.fc);
    setSat(defaults.sat);
    isApplyingTemplate.current = false;

    savedTemplatesRef.current = { ...savedTemplatesRef.current, [templateId]: defaults };
    delete rxKitsRef.current[templateId];
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          templateId,
          templates: savedTemplatesRef.current,
          rxKits: rxKitsRef.current
        })
      );
    }
  }

  function handleResetApp() {
    const firstTemplate = TEMPLATES[0];
    if (!firstTemplate) return;

    savedTemplatesRef.current = {};
    rxKitsRef.current = {};
    setBetaOk(false);
    setBetaLabel("");

    if (typeof window !== "undefined") {
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith("mvp:") || key === STORAGE_KEY || key === RX_KIT_KEY || key === "invite_code") {
            localStorage.removeItem(key);
          }
        }
        localStorage.removeItem(BETA_STORAGE_KEY);
        localStorage.removeItem("beta_remember_ok");
        localStorage.removeItem("beta_remember_until");
      } catch (err) {
        console.error("Erro limpando storage", err);
      }
      window.location.reload();
      return;
    }

    const defaults = buildTemplateDefaults(firstTemplate);
    isApplyingTemplate.current = true;
    setTemplateId(firstTemplate.id);
    setQpText(defaults.qpText);
    setHmaStates(getTemplateHmaDefaultStates(firstTemplate));
    setHmaFreeText("");
    setHmaFreeOpen(false);
    setAlarme(defaults.alarme);
    setComorb(defaults.comorb);
    setMeds(defaults.meds);
    setAlergiaNega(defaults.alergiaNega);
    setAlergiaTexto(defaults.alergiaTexto);
    setHipotese(defaults.hipotese);
    setCondutaAlarmes(defaults.condutaAlarmes);
    setAtestadoEmitir(defaults.atestadoEmitir ?? true);
    setAtestadoDias(defaults.atestadoDias ?? 1);
    setAtestadoCid(defaults.atestadoCid ?? "");
    setExameLivre(defaults.exameLivre ?? "");
    setAlarmStates(defaults.alarmStates);
    setRxSelected(defaults.rxSelected);
    setRxFormulationByItem(defaults.rxFormulationByItem ?? {});
    setRxRegimenByItem(defaults.rxRegimenByItem ?? {});
    setTriagem(defaults.triagem);
    setPa(defaults.pa);
    setFc(defaults.fc);
    setSat(defaults.sat);
    isApplyingTemplate.current = false;
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  function handlePrintRx() {
    if (!rxText) return;
    const prev = includeRx;
    setIncludeRx(true);
    if (typeof window === "undefined") return;

    const body = window.document.body;
    const cleanup = () => {
      body.classList.remove("print-rx-only");
      if (!prev) {
        setIncludeRx(false);
      }
      window.removeEventListener("afterprint", cleanup);
    };

    body.classList.add("print-rx-only");
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 50);
    }, 120);
  }

  function getSelectedIdInFamily(itemIds: string[]) {
    return itemIds.find((id) => rxSelected.includes(id));
  }

  function handleToggleRxFamily(itemIds: string[]) {
    if (!itemIds.length) return;
    const selectedInFamily = getSelectedIdInFamily(itemIds);
    if (selectedInFamily) {
      setRxSelected((prev) => prev.filter((id) => !itemIds.includes(id)));
      setRxFormulationByItem((map) => {
        const next = { ...map };
        itemIds.forEach((id) => delete next[id]);
        return next;
      });
      setRxRegimenByItem((map) => {
        const next = { ...map };
        itemIds.forEach((id) => delete next[id]);
        return next;
      });
      return;
    }
    const defaultId = itemIds[0];
    setRxSelected((prev) => [...prev.filter((id) => !itemIds.includes(id)), defaultId]);
  }

  function handleSelectRxPresentation(itemIds: string[], selectedId: string) {
    if (!itemIds.includes(selectedId)) return;
    setRxSelected((prev) => {
      const next = prev.filter((id) => !itemIds.includes(id));
      return [...next, selectedId];
    });
    setRxFormulationByItem((map) => {
      const next = { ...map };
      itemIds.forEach((id) => {
        if (id !== selectedId) delete next[id];
      });
      return next;
    });
    setRxRegimenByItem((map) => {
      const next = { ...map };
      itemIds.forEach((id) => {
        if (id !== selectedId) delete next[id];
      });
      return next;
    });
  }

  function persistStorage(currentTemplateId: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        templateId: currentTemplateId,
        templates: savedTemplatesRef.current,
        rxKits: rxKitsRef.current
      })
    );
  }

  function handleSaveRxKit() {
    rxKitsRef.current = { ...rxKitsRef.current, [templateId]: rxSelected };
    persistStorage(templateId);
  }

  function handleRestoreRxDefaults() {
    if (!currentTemplate) return;
    delete rxKitsRef.current[templateId];
    const defaults = currentTemplate.defaults.rxDefaults ?? [];
    setRxSelected(defaults);
    persistStorage(templateId);
  }

  function handleClearRxSelection() {
    setRxSelected([]);
    setRxFormulationByItem({});
    setRxRegimenByItem({});
  }

  function handleToggleHmaChip(opt: string) {
    setHmaStates((prev) => {
      const current = prev[opt] ?? "unknown";
      const next = ALARM_STATUS_ORDER[(ALARM_STATUS_ORDER.indexOf(current) + 1) % ALARM_STATUS_ORDER.length];
      return { ...prev, [opt]: next };
    });
  }

  const hmaItems = currentTemplate ? getTemplateHmaItems(currentTemplate) : [];
  const alarmItems = currentTemplate?.defaults.alarmItems ?? [];
  const workspaceContextBadges = buildWorkspaceContextBadges({
    profile,
    templateLabel: currentTemplate?.label,
    hmaItemsCount: hmaItems.length,
    hmaPresentCount,
    hmaNegCount,
    alarmCount,
    rxSelectedCount: rxSelected.length
  });
  const baseText = `${formatBlock("anamnese")}\n\n${formatBlock("exame")}\n\n${formatBlock("hipotese")}\n\n${formatBlock("conduta")}`;
  const allText = includeRx && rxText ? `${baseText}\n\nReceituário:\n${rxText}` : baseText;

  return (
    <>
      <div
        className="no-print"
        style={{
          background: "#fff8e1",
          border: "1px solid #facc15",
          color: "#92400e",
          padding: "8px 12px",
          marginBottom: 12,
          borderRadius: 8,
          fontSize: 13
        }}
      >
        não insira dados identificáveis do paciente. revise e confirme as informações (responsabilidade médica).
      </div>
      <main className="workspace-main" style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <div
          className="workspace-hero-card"
          style={{
            maxWidth: 1100,
            margin: "0 auto 16px",
            padding: "16px 20px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            background: "#ffffff"
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
            {betaDisplayName ? `Olá, Dr(a). ${betaDisplayName}` : "Olá"}
          </div>
          <div style={{ fontSize: 14, color: "#475569" }}>Escolha a queixa, marque os chips e gere a evolução em segundos</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
            <div
              role="group"
              aria-label="Perfil do paciente"
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 10,
                border: `1px solid ${PROFILE_UI_TOKENS.inactiveBorder}`,
                overflow: "hidden",
                background: "#ffffff"
              }}
            >
              {(["adulto", "pediatria"] as const).map((option) => {
                const segmentStyle = getProfileSegmentStyle(profile, option);
                return (
                  <button
                    key={option}
                    type="button"
                    className="ux-focus-control"
                    onClick={() => handleProfileChange(option)}
                    aria-pressed={profile === option}
                    style={{
                      padding: "6px 12px",
                      border: "1px solid",
                      borderColor: segmentStyle.borderColor,
                      background: segmentStyle.background,
                      color: segmentStyle.color,
                      fontSize: 14,
                      fontWeight: segmentStyle.fontWeight,
                      cursor: "pointer"
                    }}
                  >
                    {getProfileDisplayName(option)}
                  </button>
                );
              })}
            </div>
            <div role="status" aria-live="polite" style={{ fontSize: 12, color: "#1e293b", fontWeight: 600 }}>
              {getProfileContextLabel(profile)}
            </div>
            {profile === "pediatria" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 13, color: "#0f172a" }}>
                  Idade
                  <input
                    className="ux-focus-control ui-control"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="anos"
                    style={{ marginLeft: 6, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, width: 80 }}
                  />
                </label>
                <label style={{ fontSize: 13, color: "#0f172a" }}>
                  Peso
                  <input
                    className="ux-focus-control ui-control"
                    value={patientWeight}
                    onChange={(e) => setPatientWeight(e.target.value)}
                    placeholder="kg"
                    style={{ marginLeft: 6, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, width: 90 }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Assistente de evolução</h1>
      <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 12 }}>
        Templates carregados: {availableTemplates.length || 0} {profile === "pediatria" && !availableTemplates.length ? "(pediátrico em construção)" : ""}
        {" · "}Perfil ativo: {getProfileDisplayName(profile)}
        {profileSwitchFeedback ? (
          <span role="status" aria-live="polite" style={{ marginLeft: 8, color: "#1d4ed8", fontWeight: 600 }}>
            {profileSwitchFeedback}
          </span>
        ) : null}
      </div>
      {feedbackUrl && (
        <div className="no-print" style={{ marginBottom: 12 }}>
          <a href={feedbackUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", textDecoration: "none", color: "#111827", background: "#fff" }}>
            Feedback
          </a>
        </div>
      )}
      <div
        className="no-print workspace-shell"
        style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(340px, 1fr)", gap: 16, marginBottom: 16, alignItems: "start" }}
      >
        <section className="workspace-entry-panel workspace-panel" style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Entrada rápida</h2>
          <label>
            Queixa
            <br />
            {availableTemplates.length ? (
              <select
                value={templateId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setTemplateId(nextId);
                  const d = getTemplateAutoCid(nextId);
                  if (d) setAtestadoCid(d);
                }}
                style={{ width: "100%" }}
                className="ux-focus-control ui-control"
              >
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: 13, color: "#6b7280", padding: "8px 0" }}>Templates pediátricos em construção</div>
            )}
          </label>
          <br />
          <br />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button type="button" onClick={handleRestoreTemplateDefaults} disabled={!currentTemplate}>
              Restaurar padrão do template
            </button>
            <button type="button" onClick={handleResetApp}>Resetar app (limpar dados locais)</button>
          </div>

          <label>QP<br /><input value={qpText} onChange={(e) => setQpText(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
              HMA (chips){" "}
              <span style={{ color: "#6b7280", fontWeight: 400 }}>
                (Presente: {hmaPresentCount} · Nega: {hmaNegCount})
              </span>
            </div>
            {hmaItems.length ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {hmaItems.map((opt) => {
                    const status = hmaStates[opt.id] ?? "unknown";
                    const statusLabel = ALARM_STATUS_LABELS[status];
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className="ui-chip"
                        onClick={() => handleToggleHmaChip(opt.id)}
                        style={{
                          borderRadius: 8,
                          padding: "8px 12px",
                          border: `1px solid ${ALARM_STATUS_STYLES[status].border}`,
                          background: ALARM_STATUS_STYLES[status].background,
                          cursor: "pointer",
                          color: ALARM_STATUS_STYLES[status].color,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          boxShadow: "none"
                        }}
                      >
                        <span style={{ color: "#111827" }}>{opt.label}</span>
                        <span style={{ fontSize: 11, opacity: 0.85 }}>{statusLabel}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const reset: HmaStateMap = {};
                      hmaItems.forEach((it) => {
                        reset[it.id] = "unknown";
                      });
                      setHmaStates(reset);
                      setHmaFreeText("");
                      setHmaFreeOpen(false);
                    }}
                  >
                    Limpar HMA
                  </button>
                  <button
                    type="button"
                    disabled={!currentTemplate}
                    onClick={() => {
                      if (!currentTemplate) return;
                      setHmaStates(getTemplateHmaDefaultStates(currentTemplate));
                      setHmaFreeText("");
                      setHmaFreeOpen(false);
                    }}
                  >
                    Restaurar HMA do template
                  </button>
                  <button
                    type="button"
                    onClick={() => setHmaFreeOpen((v) => !v)}
                    style={{ padding: "6px 10px", borderRadius: 8 }}
                  >
                    Complemento HMA
                  </button>
                </div>
              </>
            ) : (
              <p style={{ color: "#6b7280", margin: 0 }}>HMA não configurada para esta queixa.</p>
            )}
          </div>
          {(hmaFreeOpen || hmaFreeText.trim().length > 0) && (
            <div style={{ marginBottom: 12 }}>
              <label>
                Complemento livre (opcional)<br />
                <textarea
                  value={hmaFreeText}
                  onChange={(e) => setHmaFreeText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border p-2 text-sm resize-none"
                  style={{ maxHeight: 96, overflowY: "auto" }}
                  placeholder="Complemento livre da HMA (opcional)"
                />
              </label>
            </div>
          )}
          <br />
          {hasAlarmItems ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Sinais de alarme <span style={{ color: "#6b7280", fontWeight: 400 }}>(Alarmes: {alarmCount})</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {alarmItems?.map((item) => {
                  const status = alarmStates[item.id] ?? "unknown";
                  const statusLabel = ALARM_STATUS_LABELS[status];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="ui-chip"
                      onClick={() =>
                        setAlarmStates((prev) => {
                          const current = prev[item.id] ?? "unknown";
                          const next = ALARM_STATUS_ORDER[(ALARM_STATUS_ORDER.indexOf(current) + 1) % ALARM_STATUS_ORDER.length];
                          return { ...prev, [item.id]: next };
                        })
                      }
                      style={{
                        borderRadius: 8,
                        padding: "10px 14px",
                        border: `1px solid ${ALARM_STATUS_STYLES[status].border}`,
                        background: ALARM_STATUS_STYLES[status].background,
                        color: ALARM_STATUS_STYLES[status].color,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "none",
                        minWidth: 160,
                        justifyContent: "space-between"
                      }}
                    >
                      <span>{item.label}</span>
                      <span style={{ fontSize: 12, opacity: 0.9 }}>{statusLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <label>Sinais de alarme (linha)<br /><input value={alarme} onChange={(e) => setAlarme(e.target.value)} style={{ width: "100%" }} /></label>
          )}
          <br />
          <br />

          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Comorbidades (clique para marcar)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COMORB_OPTIONS.map((opt) => {
                const active = comorbSelected.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="ui-chip"
                    onClick={() =>
                      setComorbSelected((prev) =>
                        prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                      )
                    }
                    style={{
                      borderRadius: 8,
                      padding: "8px 12px",
                      border: `1px solid ${active ? "#2563eb" : "#d1d5db"}`,
                      background: active ? "#e0ebff" : "#fff",
                      color: "#111827",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <span>{opt.abbr}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label>Comorbidades (texto livre)<br /><input value={comorb} onChange={(e) => setComorb(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <label>Medicações contínuas (linha)<br /><input value={meds} onChange={(e) => setMeds(e.target.value)} style={{ width: "100%" }} /></label><br /><br />

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={alergiaNega} onChange={(e) => setAlergiaNega(e.target.checked)} />
            Nega alergias
          </label>
          {!alergiaNega && (
            <label style={{ display: "block", marginTop: 6 }}>
              Alergias (descreva)
              <br />
              <input
                value={alergiaTexto}
                onChange={(e) => setAlergiaTexto(e.target.value)}
                placeholder="ex.: dipirona → rash"
                style={{ width: "100%" }}
              />
            </label>
          )}

          <hr style={{ margin: "16px 0" }} />

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={triagem} onChange={(e) => setTriagem(e.target.checked)} />
            Sinais vitais conforme triagem
          </label>

          {!triagem && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
              <label>PA<br /><input value={pa} onChange={(e) => setPa(e.target.value)} /></label>
              <label>FC<br /><input value={fc} onChange={(e) => setFc(e.target.value)} /></label>
              <label>Sat<br /><input value={sat} onChange={(e) => setSat(e.target.value)} /></label>
            </div>
          )}
          {triagem && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
              BEG, hidratado, corado, anictérico, acianótico, afebril. Ativo e reativo.
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <label>Exame físico livre (opcional)<br /><textarea value={exameLivre} onChange={(e) => setExameLivre(e.target.value)} style={{ width: "100%", minHeight: 80 }} /></label>
          </div>

          <hr style={{ margin: "16px 0" }} />
          <label>Hipótese (1 linha)<br /><input value={hipotese} onChange={(e) => setHipotese(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <label>Alarmes na conduta (texto)<br /><input value={condutaAlarmes} onChange={(e) => setCondutaAlarmes(e.target.value)} style={{ width: "100%" }} /></label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={atestadoEmitir} onChange={(e) => setAtestadoEmitir(e.target.checked)} />
              Emitir atestado
            </label>
            <label>Dias<br /><input type="number" min={1} value={atestadoDias} onChange={(e) => setAtestadoDias(Number(e.target.value) || 1)} style={{ width: 80 }} /></label>
            <label>CID<br /><input value={atestadoCid} onChange={(e) => setAtestadoCid(e.target.value)} style={{ width: 140 }} placeholder="ex: J06.9" /></label>
          </div>

        </section>

      <section className="workspace-output-sticky workspace-panel" style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Saída (copiar/colar)</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {workspaceContextBadges.map((badge) => (
            <span
              key={badge}
              className="ui-chip"
              style={{
                fontSize: 12,
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "4px 10px",
                background: "#f8fafc"
              }}
            >
              {badge}
            </span>
          ))}
        </div>
        <div className="no-print" style={{ fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
          observação: documento gerado sem dados identificáveis do paciente.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button onClick={() => copy(formatBlock("anamnese"))}>Copiar anamnese</button>
          <button onClick={() => copy(formatBlock("exame"))}>Copiar exame</button>
          <button onClick={() => copy(formatBlock("hipotese"))}>Copiar hipótese</button>
            <button onClick={() => copy(formatBlock("conduta"))}>Copiar conduta</button>
            <button onClick={() => copy(allText)}>Copiar tudo</button>
            <button type="button" onClick={handlePrint}>Imprimir</button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={includeRx} onChange={(e) => setIncludeRx(e.target.checked)} />
            Incluir receituário na impressão/cópia do prontuário
          </label>

          <textarea
            readOnly
            value={allText}
            style={{ width: "100%", height: "min(56vh, 420px)", fontFamily: "ui-monospace, SFMono-Regular", whiteSpace: "pre", padding: 12 }}
          />
        </section>
      </div>

      <section
        className="no-print workspace-panel"
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
          background: "#fff",
          breakInside: "avoid"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Receituário</h2>
        </div>
        {templateRxGroups.length === 0 ? (
          <p style={{ margin: "4px 0 0", color: "#666" }}>Receituário não configurado para esta queixa.</p>
        ) : (
          <>
            {templateRxGroups.map((group) => (
              <div key={group.id} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>{group.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(rxSelectionOptionsByGroup[group.id] ?? []).map((option) => {
                    const selectedId = getSelectedIdInFamily(option.itemIds);
                    const checked = Boolean(selectedId);
                    const activeItemId = selectedId ?? option.itemIds[0];
                    const item = catalogMap[activeItemId];
                    if (!item) return null;
                    const label = option.title;
                    const route = option.route ? `(${option.route})` : "";
                    const formulations = item.peds?.formulations ?? [];
                    const regimens = item.peds?.regimens ?? [];
                    const hasMultiplePresentations = option.itemIds.length > 1;
                    return (
                      <div key={option.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={checked} onChange={() => handleToggleRxFamily(option.itemIds)} />
                          <span>
                            {label}{" "}
                            {route ? <span style={{ color: "#666", fontSize: 12 }}>{route}</span> : null}
                          </span>
                        </label>
                        {checked && hasMultiplePresentations && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 24 }}>
                            <span style={{ fontSize: 12, color: "#475569" }}>Apresentação:</span>
                            <select
                              value={activeItemId}
                              onChange={(e) => handleSelectRxPresentation(option.itemIds, e.target.value)}
                              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}
                            >
                              {option.itemIds.map((familyId) => {
                                const familyItem = catalogMap[familyId];
                                if (!familyItem) return null;
                                return (
                                  <option key={familyId} value={familyId}>
                                    {getItemPresentationLabel(familyItem)}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                        {checked && !hasMultiplePresentations && formulations.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 24 }}>
                            <span style={{ fontSize: 12, color: "#475569" }}>Apresentação:</span>
                            <select
                              value={rxFormulationByItem[activeItemId] ?? formulations[0].label}
                              onChange={(e) =>
                                setRxFormulationByItem((prev) => ({
                                  ...prev,
                                  [activeItemId]: e.target.value
                                }))
                              }
                              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}
                            >
                              {formulations.map((form) => (
                                <option key={form.label} value={form.label}>
                                  {getFormulationCategory(form.label)} - {form.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {checked && regimens.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 24 }}>
                            <span style={{ fontSize: 12, color: "#475569" }}>Regime:</span>
                            <select
                              value={rxRegimenByItem[activeItemId] ?? regimens[0].id}
                              onChange={(e) =>
                                setRxRegimenByItem((prev) => ({
                                  ...prev,
                                  [activeItemId]: e.target.value
                                }))
                              }
                              style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}
                            >
                              {regimens.map((reg) => (
                                <option key={reg.id} value={reg.id}>
                                  {reg.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => copy(rxText || "Sem itens selecionados")}
                disabled={!rxText}
                style={{ border: "1px solid #d1d5db", padding: "8px 12px", borderRadius: 8, background: "#fff", cursor: "pointer" }}
              >
                Copiar receita
              </button>
              <button
                type="button"
                onClick={handlePrintRx}
                disabled={!rxText}
                style={{ border: "1px solid #d1d5db", padding: "8px 12px", borderRadius: 8, background: "#fff", cursor: "pointer" }}
              >
                Imprimir receita
              </button>
              <button
                type="button"
                onClick={handleSaveRxKit}
                disabled={!rxSelected.length}
                style={{ border: "1px solid #d1d5db", padding: "8px 12px", borderRadius: 8, background: "#fff", cursor: "pointer" }}
              >
                Salvar como meu padrão
              </button>
              <button
                type="button"
                onClick={handleRestoreRxDefaults}
                style={{ border: "1px solid #d1d5db", padding: "8px 12px", borderRadius: 8, background: "#fff", cursor: "pointer" }}
              >
                Restaurar padrão do template
              </button>
              <button
                type="button"
                onClick={handleClearRxSelection}
                style={{ border: "1px solid #d1d5db", padding: "8px 12px", borderRadius: 8, background: "#fff", cursor: "pointer" }}
              >
                Limpar seleção
              </button>
            </div>

            {groupedRx.length ? (
              <div style={{ marginTop: 12, padding: 12, background: "#f7f7f7", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                {groupedRx.map((group) => (
                  <div key={group.route} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>USO {group.route}:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {group.items.map((item, idx) => {
                        const titleBrand = getMedicationDisplayTitle(item);
                        return (
                          <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <span style={{ fontWeight: 600, whiteSpace: "pre-wrap" }}>{`${idx + 1}. ${titleBrand}`}</span>
                              <span style={{ flex: 1, borderBottom: "1px dotted #9ca3af" }} />
                              <span style={{ minWidth: 120, textAlign: "right", fontWeight: 500 }}>{item.qty}</span>
                            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 16, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 14 }}>
              {getItemDirectionsForDisplay(item).map((dir, dirIdx) => (
                <span key={dirIdx}>{dir}</span>
              ))}
            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ marginTop: 8, color: "#666" }}>Selecione itens para gerar o receituário.</p>
            )}
          </>
        )}
      </section>

      <p style={{ color: "#666", fontSize: 13 }}>
        Alarmes carregados dos templates: clique nos chips para alternar entre Não avaliado, Nega e Presente.
      </p>
      <section className="print-area" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", marginTop: 16 }}>
        <div className="print-doc" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>EVOLUÇÃO</h3>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 13, lineHeight: 1.45 }}>{allText}</pre>
        </div>
        <div className="print-doc" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>CONDUTA</h3>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 13, lineHeight: 1.45 }}>{formatBlock("conduta")}</pre>
        </div>
        {includeRx && rxText && (
          <div className="print-doc print-rx" style={{ marginBottom: 16, paddingTop: 8, breakInside: "avoid" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>RECEITUÁRIO</h3>
            {groupedRx.map((group) => (
              <div key={group.route} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>USO {group.route}:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  {group.items.map((item, idx) => {
                    const titleBrand = getMedicationDisplayTitle(item);
                    return (
                      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{`${idx + 1}. ${titleBrand}`}</span>
                          <span style={{ flex: 1, borderBottom: "1px dotted #9ca3af" }} />
                          <span style={{ minWidth: 120, textAlign: "right", fontWeight: 500 }}>{item.qty}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 16 }}>
                          {getItemDirectionsForDisplay(item).map((dir, dirIdx) => (
                            <span key={dirIdx}>{dir}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          .no-print,
          button,
          input,
          select,
        textarea {
          display: none !important;
        }

        .print-area {
          display: block !important;
          padding: 16mm !important;
          border: none !important;
          box-shadow: none !important;
        }

        main > :not(.print-area) {
          display: none !important;
        }

        .print-doc {
          page-break-inside: avoid;
          margin-bottom: 14mm;
        }

          .print-rx-only .print-doc {
            display: none !important;
          }

          .print-rx-only .print-doc.print-rx {
            display: block !important;
          }

          .print-doc h3 {
            font-size: 14pt !important;
            margin-bottom: 4mm !important;
          }

          .print-doc pre {
            font-size: 12pt !important;
            line-height: 1.4 !important;
            white-space: pre-wrap !important;
          }

          .print-rx {
            page-break-before: always;
          }
        }
      `}</style>
    </main>
      {!privacyAck && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              width: "min(480px, 90%)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>aviso importante</h3>
            <p style={{ marginTop: 0, marginBottom: 12, color: "#444", lineHeight: 1.4 }}>
              este site não deve ser usado para inserir dados identificáveis do paciente. utilize apenas iniciais, idade e dados não sensíveis.
              a revisão e validação das informações são de responsabilidade do profissional médico.
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={privacyCheckbox}
                onChange={(e) => setPrivacyCheckbox(e.target.checked)}
              />
              li e entendi
            </label>
            <button
              type="button"
              onClick={handlePrivacyContinue}
              disabled={!privacyCheckbox}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: privacyCheckbox ? "#2563eb" : "#93c5fd",
                color: "#fff",
                cursor: privacyCheckbox ? "pointer" : "not-allowed"
              }}
            >
              continuar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
