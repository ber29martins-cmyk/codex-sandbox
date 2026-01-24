"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type BlockKey = "anamnese" | "exame" | "hipotese" | "conduta";
type AlarmStatus = "unknown" | "nega" | "presente";
type AlarmStateMap = Record<string, AlarmStatus>;
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
  hipotese: string;
  condutaAlarmes: string;
  alarmStates: AlarmStateMap;
  rxSelected: string[];
  triagem: boolean;
  pa: string;
  fc: string;
  sat: string;
  comorbSelected: string[];
  atestadoEmitir?: boolean;
  atestadoDias?: number;
  atestadoCid?: string;
  exameLivre?: string;
};
type AlarmItem = { id: string; label: string; absentLabel: string; presentText: string };
type RxItem = { id: string; label: string; route: string; title: string; brand?: string; qty: string; directions: string[] };
type RxGroup = { id: string; label: string; itemIds: string[] };

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

function shortenLabel(text: string, maxLen = 42) {
  const clean = text.replace(/^Refere\s+/i, "").replace(/^Nega\s+/i, "").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

function cleanAlarmLabel(s: string) {
  return s.replace(/^(sem|nega)\s+/i, "").replace(/^não\s+apresenta\s+/i, "").trim();
}

const ALARM_PRINT_MAP: Record<string, string> = {
  "Dispneia/esforço": "dispneia / esforço respiratório",
  "Sat baixa": "saturação baixa",
  "Dor torácica": "dor torácica",
  "Dor torácica imp": "dor torácica importante",
  "Hemoptise": "hemoptise",
  "Febre >72h": "febre persistente (>72h)",
  "Febre alta >72h": "febre alta ou persistente (>72h)",
  "Febre >72h/piora": "febre persistente (>72h) ou piora após melhora",
  "Piora progressiva": "piora progressiva",
  "Piora após melhora": "piora após melhora",
  "Incapaz VO/desid": "incapaz de via oral / desidratação importante",
  "Desid importante": "sinais de desidratação importante",
  "Desid/baixa VO": "desidratação importante / baixa aceitação via oral",
  "Vômitos incoerc": "vômitos incoercíveis",
  "Confusão/rebaix": "confusão mental / rebaixamento",
  "Confusão/sonol": "confusão mental / sonolência importante",
  "confusão": "confusão mental ou alteração do nível de consciência",
  "Febre/calafrios": "febre / calafrios",
  "Dor flanco/lomb": "dor em flanco / lombalgia",
  "N/V importantes": "náuseas / vômitos importantes",
  "Sepse hipot/conf": "sinais de sepse (hipotensão / confusão)",
  "Falha terapêut": "piora progressiva ou falha terapêutica",
  "Hematêmese": "hematêmese",
  "Melena/sangram": "melena / sangramento digestivo",
  "Perda ponderal": "perda ponderal / anorexia importante",
  "Disfagia prog": "disfagia / odinofagia progressiva",
  "Vômitos persist": "vômitos persistentes",
  "Síncope/hipot": "síncope / hipotensão",
  "Equiv anginoso": "dor torácica em aperto / dispneia (equivalente anginoso)",
  "Anemia suspeita": "anemia conhecida ou suspeita",
  "Sangue nas fezes": "sangue nas fezes / melena",
  "Dor abd intensa": "dor abdominal intensa ou localizada",
  "Choque": "sinais de choque",
  "Suspeita colite": "uso recente de antibiótico / suspeita de colite",
  "Dor retroauric": "dor retroauricular",
  "Edema retroauric": "edema retroauricular",
  "Pavilhão protru": "pavilhão auricular protruído",
  "Paralisia facial": "paralisia facial",
  "Cefaleia intensa": "cefaleia intensa",
  "Meningismo": "rigidez de nuca / sinais meníngeos",
  "Toxemia": "toxemia / mau estado geral",
  "Dispneia/estridor": "dispneia / estridor",
  "Sialorreia/VO": "sialorreia / incapaz de deglutir saliva",
  "Trismo/voz abaf": "trismo / voz abafada",
  "Desvio de úvula": "desvio de úvula (suspeita de abscesso peritonsilar)",
  "Desid/recusa VO": "desidratação importante / recusa via oral",
  "Febre alta/tox": "febre alta persistente / toxemia",
  "Déficit sensitivo": "parestesia / hipoestesia",
  "Perda de força": "perda de força",
  "Alteração esfinc": "alteração esfincteriana",
  "Anestesia em sela": "anestesia em sela",
  "Fala entrecort": "fala entrecortada / incapaz de falar frases",
  "Tórax silenc": "tórax silencioso / redução importante do murmúrio vesicular",
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
  "incapaz deglut": "incapaz de deglutir / recusa via oral",
  "dispneia/estridor": "dispneia / estridor",
  "sinais infecção": "sinais de infecção secundária"
};

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

function getTemplateHmaItems(template: Template) {
  if (!Array.isArray(template.defaults.hmaItems)) return [];
  return template.defaults.hmaItems.map((item, idx) => {
    const label = item.label && item.label.trim().length ? item.label : shortenLabel(item.text || `HMA ${idx + 1}`);
    return { ...item, label };
  });
}

function getTemplateHmaDefaults(template: Template) {
  const defaults = Array.isArray(template.defaults.hmaDefaults) ? template.defaults.hmaDefaults : [];
  if (defaults.length) return defaults;
  return getTemplateHmaItems(template).map((item) => item.id);
}

function buildTemplateDefaults(template: Template): TemplateState {
  return {
    qpText: getTemplateQP(template),
    alarme: template.defaults.alarme,
    comorb: template.defaults.comorb,
    meds: template.defaults.meds,
    hipotese: template.defaults.hipotese ?? (template.label as string) ?? ((template as any).title ?? ""),
    condutaAlarmes: template.defaults.condutaAlarmes ?? "Retorno imediato se sinais de alarme ou piora do quadro",
    alarmStates: buildDefaultAlarmStates(template),
    rxSelected: template.defaults.rxDefaults ?? [],
    triagem: true,
    pa: "",
    fc: "",
    sat: "",
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
const TEMPLATES = ((templatesData as { templates: Template[] }).templates ?? []).slice().sort((a, b) => a.label.localeCompare(b.label, "pt", { sensitivity: "base" }));
const INITIAL_TEMPLATE = TEMPLATES[0];
const INITIAL_DEFAULTS = INITIAL_TEMPLATE ? buildTemplateDefaults(INITIAL_TEMPLATE) : null;
const RX_CATALOG = (rxCatalogData as { items: RxItem[] }).items;
const RX_GROUPS = (rxGroupsData as { groups: RxGroup[] }).groups;
const RX_CATALOG_MAP: Record<string, RxItem> = Object.fromEntries(RX_CATALOG.map((item) => [item.id, item]));
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
  return cidFromKey(key);
};


export default function Page() {
    const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]?.id ?? "lombalgia");
  const router = useRouter();
  const pathname = usePathname();
  const currentTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0],
    [templateId]
  );

  const validateBeta = async () => {
    const code = betaInput.trim();
    const email = betaEmail.trim().toLowerCase();
    if (!code) {
      setBetaError("invalid");
      return;
    }
    if (!email) {
      setBetaError("invalid_email");
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
  const [alarmStates, setAlarmStates] = useState<AlarmStateMap>({});
  const [rxSelected, setRxSelected] = useState<string[]>([]);
  const [hmaSelected, setHmaSelected] = useState<string[]>([]);
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
  const [includeRx, setIncludeRx] = useState(false);
  const [comorbSelected, setComorbSelected] = useState<string[]>([]);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [privacyCheckbox, setPrivacyCheckbox] = useState(false);
  const [betaOk, setBetaOk] = useState(false);
  const [betaLabel, setBetaLabel] = useState<string>("");
  const [betaInput, setBetaInput] = useState("");
  const [betaEmail, setBetaEmail] = useState("");
  const [betaError, setBetaError] = useState<string>("");
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaHydrating, setBetaHydrating] = useState(true);
  const [betaToast, setBetaToast] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const didHydrate = useRef(false);
  const urlPrefillDone = useRef(false);
  const autoActivateTried = useRef(false);
  const isApplyingTemplate = useRef(false);
  const savedTemplatesRef = useRef<Record<string, Partial<TemplateState>>>({});
  const rxKitsRef = useRef<Record<string, string[]>>({});
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackUrl = FEEDBACK_URL;

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
    return () => {
      clearBetaToast();
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
    let selectedFromStorage: string[] | undefined;
    let freeFromStorage = "";
    if (typeof window !== "undefined") {
      try {
        const storedSelected = localStorage.getItem(`${HMA_SELECTED_PREFIX}${templateId}`);
        if (storedSelected) {
          const parsed = JSON.parse(storedSelected);
          if (Array.isArray(parsed)) selectedFromStorage = parsed.filter((v) => typeof v === "string");
        }
        const storedFree = localStorage.getItem(`${HMA_FREE_PREFIX}${templateId}`);
        if (typeof storedFree === "string") {
          freeFromStorage = storedFree;
        }
      } catch (err) {
        console.error("Erro ao carregar HMA do storage", err);
      }
    }
    const defaultsHma = getTemplateHmaDefaults(currentTemplate);
    setHmaSelected((selectedFromStorage && selectedFromStorage.length ? selectedFromStorage : defaultsHma).filter(Boolean));
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
    setComorbSelected(templateState.comorbSelected ?? []);
    setAtestadoEmitir(templateState.atestadoEmitir ?? true);
    setAtestadoDias(templateState.atestadoDias ?? 1);
    setAtestadoCid(templateState.atestadoCid ?? "");
    setExameLivre(templateState.exameLivre ?? "");
    const kit = rxKitsRef.current[templateId];
    setRxSelected(kit ?? currentTemplate.defaults.rxDefaults ?? []);
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
      hipotese,
      condutaAlarmes,
      alarmStates,
      rxSelected,
      triagem,
      pa,
      fc,
      sat,
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
  }, [templateId, qpText, alarme, comorb, meds, hipotese, condutaAlarmes, alarmStates, rxSelected, triagem, pa, fc, sat, comorbSelected, atestadoEmitir, atestadoDias, atestadoCid, exameLivre]);

  useEffect(() => {
    if (!didHydrate.current || isApplyingTemplate.current) return;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`${HMA_SELECTED_PREFIX}${templateId}`, JSON.stringify(hmaSelected));
      localStorage.setItem(`${HMA_FREE_PREFIX}${templateId}`, hmaFreeText);
    } catch (err) {
      console.error("Erro ao salvar HMA", err);
    }
  }, [hmaSelected, hmaFreeText, templateId]);

  const alarmCount = (currentTemplate.defaults.alarmItems ?? []).length;
  const hasAlarmItems = alarmCount > 0;
  const alarmLines = useMemo(() => {
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
    return (currentTemplate.defaults.rxGroups ?? []).map((id) => RX_GROUP_MAP[id] ?? { id, label: id, itemIds: [] });
  }, [currentTemplate]);
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
      const item = RX_CATALOG_MAP[id];
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
  }, [orderedSelectedRxIds]);
  const rxText = useMemo(() => {
    if (!orderedSelectedRxIds.length) return "";
    const byRoute: Record<string, RxItem[]> = {};

    for (const id of orderedSelectedRxIds) {
      const item = RX_CATALOG_MAP[id];
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
          const titleBrand = item.brand ? `${item.title} (${item.brand})` : item.title;
          const base = `${index + 1}. ${titleBrand}`;
          const dotsWidth = Math.max(2, 80 - base.length - item.qty.length - 2);
          const dotted = `${base} ${".".repeat(dotsWidth)} ${item.qty}`;
          lines.push(dotted);
          item.directions.forEach((dir) => {
            if (dir.trim()) lines.push(dir.trim());
          });
          if (index < items.length - 1) {
            lines.push("");
          }
        });
        return lines.join("\n").trim();
      });

    return routeBlocks.join("\n\n").trim();
  }, [orderedSelectedRxIds]);
  
  const hmaParagraphs = useMemo(() => {
    const items = getTemplateHmaItems(currentTemplate);
    const selectedSet = new Set(hmaSelected);
    const selectedTexts = items.filter((it) => selectedSet.has(it.id)).map((it) => it.text).filter(Boolean);
    const mainParagraph = formatParagraph(selectedTexts);

    const freeParagraph = hmaFreeText
      ? formatParagraph(
          hmaFreeText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        )
      : "";

    const paragraphs = [];
    if (mainParagraph) paragraphs.push(mainParagraph);
    if (freeParagraph) paragraphs.push(freeParagraph);
    return paragraphs;
  }, [hmaSelected, hmaFreeText, currentTemplate]);

  const blocks = useMemo(() => {
    const anamnese = [
      `QP: ${currentTemplate.label}`,
      hmaParagraphs.length ? `HMA: ${hmaParagraphs[0]}` : "",
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
      alergiaNega ? "Nega alergias" : ""
    ].filter(Boolean);

    const vitalsLine =
      !triagem && (pa || fc || sat)
        ? `PA ${pa || "___"} FC ${fc || "___"} Sat ${sat || "___"}`
        : triagem
          ? "Sinais vitais conforme triagem"
          : "";

    const exameRaw = currentTemplate.defaults.exame;
    const exameBase = Array.isArray(exameRaw) ? exameRaw : exameRaw ? [exameRaw] : [];
    const dedupedExameBase =
      vitalsLine && exameBase.length
        ? exameBase.filter((line, idx) => !(idx === 0 && line.trim().toLowerCase() === vitalsLine.trim().toLowerCase()))
        : exameBase;
    const exameLivreLinhas = exameLivre
      ? exameLivre
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      : [];

    const exame = [vitalsLine, ...dedupedExameBase, ...exameLivreLinhas].filter(Boolean);

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
    alergiaNega,
    triagem,
    pa,
    fc,
    sat,
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

  const betaToastTimeout = useRef<number | undefined>(undefined);

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
      <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>acesso beta</h1>
        <p style={{ marginBottom: 12, color: "#444" }}>
          Insira seu código de acesso e o e-mail usado na ativação para continuar.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              value={betaInput}
              onChange={(e) => setBetaInput(e.target.value)}
              placeholder="PLANTAO-XXXX-YYYY"
              disabled={betaBusy}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", minWidth: 240 }}
            />
            <input
              value={betaEmail}
              onChange={(e) => setBetaEmail(e.target.value)}
              placeholder="email@exemplo.com"
              disabled={betaBusy}
              ref={emailInputRef}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", minWidth: 240 }}
            />
          </div>
          <button
            type="button"
            onClick={validateBeta}
            disabled={betaBusy}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: betaBusy ? "#93c5fd" : "#2563eb",
              color: "#fff",
              cursor: betaBusy ? "not-allowed" : "pointer"
            }}
          >
            {betaBusy ? "Validando..." : "Entrar"}
          </button>
          {(isAdminMode || (betaLabel && betaLabel.toLowerCase() === "owner")) && (
            <button
              type="button"
              onClick={handleCopyInviteLink}
              disabled={betaBusy}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#2563eb",
                fontSize: 13,
                cursor: betaBusy ? "not-allowed" : "pointer"
              }}
            >
              copiar link de convite
            </button>
          )}
        </div>
        {betaHydrating && !betaError && (
          <div style={{ color: "#4b5563", fontSize: 13, marginTop: 4 }}>Validando acesso salvo...</div>
        )}
        {betaToast && (
          <div style={{ color: "#15803d", fontSize: 13, marginTop: 4 }}>
            {betaToast}
          </div>
        )}
        {betaError && (
          <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 4 }}>
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
      </main>
    );
  }

  function handleRestoreTemplateDefaults() {
    if (!currentTemplate) return;

    const defaults = buildTemplateDefaults(currentTemplate);
    isApplyingTemplate.current = true;
    setQpText(defaults.qpText);
    setHmaSelected(getTemplateHmaDefaults(currentTemplate));
    setHmaFreeText("");
    setHmaFreeOpen(false);
    setAlarme(defaults.alarme);
    setComorb(defaults.comorb);
    setMeds(defaults.meds);
    setHipotese(defaults.hipotese);
    setCondutaAlarmes(defaults.condutaAlarmes);
    setAtestadoEmitir(defaults.atestadoEmitir ?? true);
    setAtestadoDias(defaults.atestadoDias ?? 1);
    setAtestadoCid(defaults.atestadoCid ?? "");
    setExameLivre(defaults.exameLivre ?? "");
    setAlarmStates(defaults.alarmStates);
    setRxSelected(defaults.rxSelected);
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

    if (typeof window !== "undefined") {
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith("mvp:") || key === STORAGE_KEY || key === RX_KIT_KEY || key === "invite_code") {
            localStorage.removeItem(key);
          }
        }
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
    setHmaSelected(getTemplateHmaDefaults(firstTemplate));
    setHmaFreeText("");
    setHmaFreeOpen(false);
    setAlarme(defaults.alarme);
    setComorb(defaults.comorb);
    setMeds(defaults.meds);
    setHipotese(defaults.hipotese);
    setCondutaAlarmes(defaults.condutaAlarmes);
    setAtestadoEmitir(defaults.atestadoEmitir ?? true);
    setAtestadoDias(defaults.atestadoDias ?? 1);
    setAtestadoCid(defaults.atestadoCid ?? "");
    setExameLivre(defaults.exameLivre ?? "");
    setAlarmStates(defaults.alarmStates);
    setRxSelected(defaults.rxSelected);
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
    setTimeout(() => {
      window.print();
      if (!prev) {
        setIncludeRx(false);
      }
    }, 100);
  }

  function handleToggleRx(id: string) {
    setRxSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((rx) => rx !== id);
      }
      return [...prev, id];
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
  }

  function handleToggleHmaChip(opt: string) {
    setHmaSelected((prev) => {
      if (prev.includes(opt)) {
        return prev.filter((line) => line !== opt);
      }
      return [...prev, opt];
    });
  }

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
      <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>MVP Prontuário (blocos)</h1>
      <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 12 }}>Templates carregados: {TEMPLATES.length}</div>
      {feedbackUrl && (
        <div className="no-print" style={{ marginBottom: 12 }}>
          <a href={feedbackUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", textDecoration: "none", color: "#111827", background: "#fff" }}>
            Feedback
          </a>
        </div>
      )}
      <div className="no-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Entrada rápida</h2>
<label>
  Queixa
  <br />
  <select
    value={templateId}
    onChange={(e) => {
      const nextId = e.target.value;
      setTemplateId(nextId);
      const d = getTemplateAutoCid(nextId);
      if (d) setAtestadoCid(d);
    }}
    style={{ width: "100%" }}
  >
    {TEMPLATES.map((t) => (
      <option key={t.id} value={t.id}>
        {t.label}
      </option>
    ))}
  </select>
</label>
<br />
<br />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button type="button" onClick={handleRestoreTemplateDefaults}>Restaurar padrão do template</button>
            <button type="button" onClick={handleResetApp}>Resetar app (limpar dados locais)</button>
          </div>

          <label>QP<br /><input value={qpText} onChange={(e) => setQpText(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
              HMA (chips) <span style={{ color: "#6b7280", fontWeight: 400 }}>(Selecionados: {hmaSelected.length})</span>
            </div>
            {getTemplateHmaItems(currentTemplate).length ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {getTemplateHmaItems(currentTemplate).map((opt) => {
                    const active = hmaSelected.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleToggleHmaChip(opt.id)}
                        style={{
                          borderRadius: 999,
                          padding: "8px 12px",
                          border: `1px solid ${active ? "#2563eb" : "#d1d5db"}`,
                          background: active ? "#e0ebff" : "#fff",
                          cursor: "pointer",
                          color: "#111827"
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setHmaSelected([]);
                      setHmaFreeText("");
                      setHmaFreeOpen(false);
                    }}
                  >
                    Limpar HMA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHmaSelected(getTemplateHmaDefaults(currentTemplate));
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
                {currentTemplate.defaults.alarmItems?.map((item) => {
                  const status = alarmStates[item.id] ?? "unknown";
                  const statusLabel = ALARM_STATUS_LABELS[status];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setAlarmStates((prev) => {
                          const current = prev[item.id] ?? "unknown";
                          const next = ALARM_STATUS_ORDER[(ALARM_STATUS_ORDER.indexOf(current) + 1) % ALARM_STATUS_ORDER.length];
                          return { ...prev, [item.id]: next };
                        })
                      }
                      style={{
                        borderRadius: 999,
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
                    onClick={() =>
                      setComorbSelected((prev) =>
                        prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                      )
                    }
                    style={{
                      borderRadius: 999,
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

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Saída (copiar/colar)</h2>
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

          <textarea readOnly value={allText} style={{ width: "100%", height: 420, fontFamily: "ui-monospace, SFMono-Regular", whiteSpace: "pre", padding: 12 }} />
        </section>
      </div>

      <section className="no-print" style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Receituário</h2>
        {templateRxGroups.length === 0 ? (
          <p style={{ margin: "4px 0 0", color: "#666" }}>Receituário não configurado para esta queixa.</p>
        ) : (
          <>
            {templateRxGroups.map((group) => (
              <div key={group.id} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>{group.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.itemIds.map((itemId) => {
                    const item = RX_CATALOG_MAP[itemId];
                    const label = item?.label ?? itemId;
                    const route = item?.route ? `(${item.route})` : "";
                    const checked = rxSelected.includes(itemId);
                    return (
                      <label key={itemId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" checked={checked} onChange={() => handleToggleRx(itemId)} />
                        <span>
                          {label}{" "}
                          {route ? <span style={{ color: "#666", fontSize: 12 }}>{route}</span> : null}
                        </span>
                      </label>
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
                        const titleBrand = item.brand ? `${item.title} (${item.brand})` : item.title;
                        return (
                          <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <span style={{ fontWeight: 600, whiteSpace: "pre-wrap" }}>{`${idx + 1}. ${titleBrand}`}</span>
                              <span style={{ flex: 1, borderBottom: "1px dotted #9ca3af" }} />
                              <span style={{ minWidth: 120, textAlign: "right", fontWeight: 500 }}>{item.qty}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 16, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 13 }}>
                              {item.directions.map((dir, dirIdx) => (
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
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Documentos gerados</h2>
        <div className="print-doc" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Prontuário / Admissão</h3>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 13, lineHeight: 1.45 }}>{allText}</pre>
        </div>
        <div className="print-doc" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Receita / Conduta</h3>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 13, lineHeight: 1.45 }}>{formatBlock("conduta")}</pre>
        </div>
        {includeRx && rxText && (
          <div className="print-doc print-rx" style={{ marginBottom: 16, paddingTop: 8 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Receituário</h3>
            {groupedRx.map((group) => (
              <div key={group.route} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>USO {group.route}:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.items.map((item, idx) => {
                    const titleBrand = item.brand ? `${item.title} (${item.brand})` : item.title;
                    return (
                      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{`${idx + 1}. ${titleBrand}`}</span>
                          <span style={{ flex: 1, borderBottom: "1px dotted #9ca3af" }} />
                          <span style={{ minWidth: 120, textAlign: "right", fontWeight: 500 }}>{item.qty}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 16 }}>
                          {item.directions.map((dir, dirIdx) => (
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

          .print-doc {
            page-break-inside: avoid;
            margin-bottom: 14mm;
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
