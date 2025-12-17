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
    hma?: string;
    qpDefault?: string;
    hmaDefault?: string[];
    alarme: string;
    comorb: string;
    meds: string;
    hipotese: string;
    condutaAlarmes: string;
    exame: string[];
    alarmItems?: { key: string; label: string }[];
    rxGroups?: string[];
    rxDefaults?: string[];
  };
};
type TemplateState = {
  qpText: string;
  hmaText: string;
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
};
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
const RX_ROUTE_ORDER = ["ORAL", "PARENTERAL", "TOPICO", "OFTALMICO", "INALATORIO"];
const RX_KIT_KEY = "codex-rx-kits-v1";

function buildDefaultAlarmStates(template: Template): AlarmStateMap {
  const items = template.defaults.alarmItems ?? [];
  if (!items.length) return {};

  const initialState: AlarmStateMap = {};
  for (const item of items) {
    initialState[item.key] = "nega";
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

function getTemplateHma(template: Template) {
  if (template.defaults.hmaDefault?.length) return template.defaults.hmaDefault;
  return [];
}

function buildTemplateDefaults(template: Template): TemplateState {
  return {
    qpText: getTemplateQP(template),
    hmaText: getTemplateHma(template).join("\n"),
    alarme: template.defaults.alarme,
    comorb: template.defaults.comorb,
    meds: template.defaults.meds,
    hipotese: template.defaults.hipotese,
    condutaAlarmes: template.defaults.condutaAlarmes,
    alarmStates: buildDefaultAlarmStates(template),
    rxSelected: template.defaults.rxDefaults ?? [],
    triagem: true,
    pa: "",
    fc: "",
    sat: "",
    comorbSelected: []
  };
}



import templatesData from "../templates/templates.json";
import rxCatalogData from "../prescriptions/catalog.json";
import rxGroupsData from "../prescriptions/groups.json";
import { INVITE_CODES, isInviteValid } from "../lib/invite";
const TEMPLATES = ((templatesData as { templates: Template[] }).templates ?? []).slice().sort((a, b) => a.label.localeCompare(b.label, "pt", { sensitivity: "base" }));
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


export default function Page() {
    const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]?.id ?? "lombalgia");
  const router = useRouter();
  const pathname = usePathname();
const currentTemplate = useMemo(
  () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0],
  [templateId]
);
  const [qpText, setQpText] = useState("");
  const [hmaText, setHmaText] = useState("");
  const [alarme, setAlarme] = useState("Nega perda de força, anestesia em sela e alteração esfincteriana");
  const [comorb, setComorb] = useState("DM NIR, HAS");
  const [meds, setMeds] = useState("Metformina 500mg 1-0-1 + Losartana 50mg 1-0-1");
  const [alergiaNega, setAlergiaNega] = useState(true);
  const [alarmStates, setAlarmStates] = useState<AlarmStateMap>({});
  const [rxSelected, setRxSelected] = useState<string[]>([]);
  const [triagem, setTriagem] = useState(true);
  const [pa, setPa] = useState("");
  const [fc, setFc] = useState("");
  const [sat, setSat] = useState("");
  const [includeRx, setIncludeRx] = useState(false);
  const [comorbSelected, setComorbSelected] = useState<string[]>([]);
  const didHydrate = useRef(false);
  const isApplyingTemplate = useRef(false);
  const savedTemplatesRef = useRef<Record<string, Partial<TemplateState>>>({});
  const rxKitsRef = useRef<Record<string, string[]>>({});
  const inviteChecked = useRef(false);
  const feedbackUrl = FEEDBACK_URL;

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { templateId?: string; templates?: Record<string, TemplateState>; rxKits?: Record<string, string[]> }) : {};
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
      didHydrate.current = true;
    }
  }, []);

  useEffect(() => {
    if (inviteChecked.current) return;
    if (typeof window === "undefined") return;
    const code = localStorage.getItem("invite_code");
    if (!isInviteValid(code)) {
      if (pathname !== "/beta") {
        router.replace("/beta");
      }
      return;
    }
    inviteChecked.current = true;
  }, [router, pathname]);

  useEffect(() => {
    if (!currentTemplate || !didHydrate.current) return;
    const savedState = savedTemplatesRef.current[templateId];
    const templateState = { ...buildTemplateDefaults(currentTemplate), ...savedState };

    isApplyingTemplate.current = true;
    setQpText(templateState.qpText ?? "");
    setHmaText(
      templateState.hmaText && templateState.hmaText.length
        ? templateState.hmaText
        : getTemplateHma(currentTemplate).join("\n")
    );
    setAlarme(templateState.alarme);
    setComorb(templateState.comorb);
    setMeds(templateState.meds);
    setHipotese(templateState.hipotese);
    setCondutaAlarmes(templateState.condutaAlarmes);
    setAlarmStates(templateState.alarmStates ?? buildDefaultAlarmStates(currentTemplate));
    setTriagem(templateState.triagem ?? true);
    setPa(templateState.pa ?? "");
    setFc(templateState.fc ?? "");
    setSat(templateState.sat ?? "");
    setComorbSelected(templateState.comorbSelected ?? []);
    const kit = rxKitsRef.current[templateId];
    setRxSelected(kit ?? currentTemplate.defaults.rxDefaults ?? []);
    isApplyingTemplate.current = false;
  }, [templateId, currentTemplate]);

  const [hipotese, setHipotese] = useState("Lombalgia");
  const [condutaAlarmes, setCondutaAlarmes] = useState("Perda de força em MMII, anestesia em sela, retenção urinária/incontinência");
  useEffect(() => {
    if (!didHydrate.current || isApplyingTemplate.current) return;

    const currentState: TemplateState = {
      qpText,
      hmaText,
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
      comorbSelected
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
  }, [templateId, qpText, hmaText, alarme, comorb, meds, hipotese, condutaAlarmes, alarmStates, rxSelected, triagem, pa, fc, sat, comorbSelected]);

  const alarmCount = (currentTemplate.defaults.alarmItems ?? []).length;
  const hasAlarmItems = alarmCount > 0;
  const alarmLine = useMemo(() => {
    const items = currentTemplate.defaults.alarmItems ?? [];
    if (!items.length) return alarme.trim();

    const negatives: string[] = [];
    const positives: string[] = [];
    for (const item of items) {
      const status = alarmStates[item.key] ?? "unknown";
      if (status === "nega") negatives.push(item.label);
      if (status === "presente") positives.push(item.label);
    }

    const parts: string[] = [];
    if (negatives.length) {
      parts.push(`Nega sinais de alarme: ${negatives.join(", ")}`);
    }
    if (positives.length) {
      parts.push(`Apresenta sinais de alarme: ${positives.join(", ")}`);
    }

    return parts.join(" / ");
  }, [alarme, alarmStates, currentTemplate]);
  const templateRxGroups = useMemo(() => {
    return (currentTemplate.defaults.rxGroups ?? []).map((id) => RX_GROUP_MAP[id] ?? { id, label: id, itemIds: [] });
  }, [currentTemplate]);
  const groupedRx = useMemo(() => {
    const byRoute: Record<string, RxItem[]> = {};
    for (const id of rxSelected) {
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
  }, [rxSelected]);
  const rxText = useMemo(() => {
    if (!rxSelected.length) return "";
    const byRoute: Record<string, RxItem[]> = {};

    for (const id of rxSelected) {
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
  }, [rxSelected]);
  
  const blocks = useMemo(() => {
    const hmaLines = hmaText ? hmaText.split("\n").filter(Boolean) : [];
    const anamnese = [
      `QP: ${currentTemplate.label}`,
      hmaLines.length ? `HMA: ${hmaLines[0]}` : "",
      ...hmaLines.slice(1),
      alarmLine ? `Sinais de alarme: ${alarmLine}` : "",
      (() => {
        const selectedAbbrs = COMORB_OPTIONS.filter((c) => comorbSelected.includes(c.id)).map((c) => c.abbr);
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

    const exameBase = currentTemplate.defaults.exame ?? [];
    const exame = [vitalsLine, ...exameBase].filter(Boolean);

    const avaliacao = [hipotese].filter(Boolean);

  const conduta = [
      "Orientado sobre o quadro e conduta",
      `Orientado sinais de alarme: ${condutaAlarmes}`,
      "Retorno imediato se sinais de alarme ou piora do quadro",
      "Paciente esclarecido e de acordo com as orientações"
    ];

    return { anamnese, exame, hipotese: avaliacao, conduta };
  }, [qpText, hmaText, alarmLine, comorb, meds, alergiaNega, triagem, pa, fc, sat, hipotese, condutaAlarmes, currentTemplate, templateId]);

  function formatBlock(key: BlockKey) {
    return blocks[key].join("\n");
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  function handleRestoreHmaFromTemplate() {
    if (!currentTemplate) return;
    const hmaLines = getTemplateHma(currentTemplate);
    setHmaText(hmaLines.join("\n"));
  }

  function handleRestoreTemplateDefaults() {
    if (!currentTemplate) return;

    const defaults = buildTemplateDefaults(currentTemplate);
    isApplyingTemplate.current = true;
    setQpText(defaults.qpText);
    setHmaText(defaults.hmaText);
    setAlarme(defaults.alarme);
    setComorb(defaults.comorb);
    setMeds(defaults.meds);
    setHipotese(defaults.hipotese);
    setCondutaAlarmes(defaults.condutaAlarmes);
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

    const defaults = buildTemplateDefaults(firstTemplate);
    savedTemplatesRef.current = {};
    isApplyingTemplate.current = true;
    setTemplateId(firstTemplate.id);
    setQpText(defaults.qpText);
    setHmaText(defaults.hmaText);
    setAlarme(defaults.alarme);
    setComorb(defaults.comorb);
    setMeds(defaults.meds);
    setHipotese(defaults.hipotese);
    setCondutaAlarmes(defaults.condutaAlarmes);
    setAlarmStates(defaults.alarmStates);
    setRxSelected(defaults.rxSelected);
    setTriagem(defaults.triagem);
    setPa(defaults.pa);
    setFc(defaults.fc);
    setSat(defaults.sat);
    rxKitsRef.current = {};
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
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

  const baseText = `${formatBlock("anamnese")}\n\n${formatBlock("exame")}\n\n${formatBlock("hipotese")}\n\n${formatBlock("conduta")}`;
  const allText = includeRx && rxText ? `${baseText}\n\nReceituário:\n${rxText}` : baseText;

  return (
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
    onChange={(e) => setTemplateId(e.target.value)}
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
          <label>HMA (uma linha por parágrafo)<br /><textarea value={hmaText} onChange={(e) => setHmaText(e.target.value)} style={{ width: "100%", minHeight: 120 }} /></label>
          <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 12 }}>
            <button type="button" onClick={handleRestoreHmaFromTemplate}>Restaurar HMA do template</button>
          </div>
          <br />
          {hasAlarmItems ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Sinais de alarme <span style={{ color: "#6b7280", fontWeight: 400 }}>(Alarmes: {alarmCount})</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {currentTemplate.defaults.alarmItems?.map((item) => {
                  const status = alarmStates[item.key] ?? "unknown";
                  const statusLabel = ALARM_STATUS_LABELS[status];

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setAlarmStates((prev) => {
                          const current = prev[item.key] ?? "unknown";
                          const next = ALARM_STATUS_ORDER[(ALARM_STATUS_ORDER.indexOf(current) + 1) % ALARM_STATUS_ORDER.length];
                          return { ...prev, [item.key]: next };
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

          <hr style={{ margin: "16px 0" }} />
          <label>Hipótese (1 linha)<br /><input value={hipotese} onChange={(e) => setHipotese(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <label>Alarmes na conduta (texto)<br /><input value={condutaAlarmes} onChange={(e) => setCondutaAlarmes(e.target.value)} style={{ width: "100%" }} /></label>

        </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Saída (copiar/colar)</h2>

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
  );
}
