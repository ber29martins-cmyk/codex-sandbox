"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BlockKey = "anamnese" | "exame" | "hipotese" | "conduta";
type AlarmStatus = "unknown" | "nega" | "presente";
type AlarmStateMap = Record<string, AlarmStatus>;
type Template = {
  id: string;
  label: string;
  defaults: {
    qp: string;
    te: string;
    assoc: string;
    alarme: string;
    comorb: string;
    meds: string;
    hipotese: string;
    condutaAlarmes: string;
    alarmItems?: { key: string; label: string }[];
    rxGroups?: string[];
    rxDefaults?: string[];
  };
};
type TemplateState = {
  qp: string;
  te: string;
  assoc: string;
  alarme: string;
  comorb: string;
  meds: string;
  hipotese: string;
  condutaAlarmes: string;
  alarmStates: AlarmStateMap;
  rxSelected: string[];
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

function buildDefaultAlarmStates(template: Template): AlarmStateMap {
  const items = template.defaults.alarmItems ?? [];
  if (!items.length) return {};

  const initialState: AlarmStateMap = {};
  for (const item of items) {
    initialState[item.key] = "nega";
  }
  return initialState;
}

function buildTemplateDefaults(template: Template): TemplateState {
  return {
    qp: template.defaults.qp,
    te: template.defaults.te,
    assoc: template.defaults.assoc,
    alarme: template.defaults.alarme,
    comorb: template.defaults.comorb,
    meds: template.defaults.meds,
    hipotese: template.defaults.hipotese,
    condutaAlarmes: template.defaults.condutaAlarmes,
    alarmStates: buildDefaultAlarmStates(template),
    rxSelected: template.defaults.rxDefaults ?? []
  };
}



import templatesData from "../templates/templates.json";
import rxCatalogData from "../prescriptions/catalog.json";
import rxGroupsData from "../prescriptions/groups.json";
const TEMPLATES = (templatesData as { templates: Template[] }).templates;
const RX_CATALOG = (rxCatalogData as { items: RxItem[] }).items;
const RX_GROUPS = (rxGroupsData as { groups: RxGroup[] }).groups;
const RX_CATALOG_MAP: Record<string, RxItem> = Object.fromEntries(RX_CATALOG.map((item) => [item.id, item]));
const RX_GROUP_MAP: Record<string, RxGroup> = Object.fromEntries(RX_GROUPS.map((group) => [group.id, group]));


export default function Page() {
    const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]?.id ?? "lombalgia");
const currentTemplate = useMemo(
  () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0],
  [templateId]
);
  const [qp, setQp] = useState("Dor lombar");
  const [te, setTe] = useState("3 dias");
  const [assoc, setAssoc] = useState("Sem irradiação, sem trauma");
  const [alarme, setAlarme] = useState("Nega perda de força, anestesia em sela e alteração esfincteriana");
  const [comorb, setComorb] = useState("DM NIR, HAS");
  const [meds, setMeds] = useState("Metformina 500mg 1-0-1 + Losartana 50mg 1-0-1");
  const [alergiaNega, setAlergiaNega] = useState(true);
  const [alarmStates, setAlarmStates] = useState<AlarmStateMap>({});
  const [rxSelected, setRxSelected] = useState<string[]>([]);
  const didHydrate = useRef(false);
  const isApplyingTemplate = useRef(false);
  const savedTemplatesRef = useRef<Record<string, TemplateState>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { templateId?: string; templates?: Record<string, TemplateState> }) : {};
      savedTemplatesRef.current = parsed.templates ?? {};

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
    if (!currentTemplate || !didHydrate.current) return;
    const savedState = savedTemplatesRef.current[templateId];
    const templateState = savedState ?? buildTemplateDefaults(currentTemplate);

    isApplyingTemplate.current = true;
    setQp(templateState.qp);
    setTe(templateState.te);
    setAssoc(templateState.assoc);
    setAlarme(templateState.alarme);
    setComorb(templateState.comorb);
    setMeds(templateState.meds);
    setHipotese(templateState.hipotese);
    setCondutaAlarmes(templateState.condutaAlarmes);
    setAlarmStates(templateState.alarmStates ?? buildDefaultAlarmStates(currentTemplate));
    setRxSelected(templateState.rxSelected ?? currentTemplate.defaults.rxDefaults ?? []);
    isApplyingTemplate.current = false;
  }, [templateId, currentTemplate]);

  const [triagem, setTriagem] = useState(true);
  const [pa, setPa] = useState("");
  const [fc, setFc] = useState("");
  const [sat, setSat] = useState("");

  const [hipotese, setHipotese] = useState("Lombalgia");
  const [condutaAlarmes, setCondutaAlarmes] = useState("Perda de força em MMII, anestesia em sela, retenção urinária/incontinência");
  useEffect(() => {
    if (!didHydrate.current || isApplyingTemplate.current) return;

    const currentState: TemplateState = {
      qp,
      te,
      assoc,
      alarme,
      comorb,
      meds,
      hipotese,
      condutaAlarmes,
      alarmStates,
      rxSelected
    };

    savedTemplatesRef.current = { ...savedTemplatesRef.current, [templateId]: currentState };

    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          templateId,
          templates: savedTemplatesRef.current
        })
      );
    }
  }, [templateId, qp, te, assoc, alarme, comorb, meds, hipotese, condutaAlarmes, alarmStates, rxSelected]);

  const hasAlarmItems = (currentTemplate.defaults.alarmItems ?? []).length > 0;
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
      parts.push(`Nega ${negatives.join(", ")}`);
    }
    if (positives.length) {
      const suffix = positives.length > 1 ? "presentes" : "presente";
      parts.push(`${positives.join(", ")} ${suffix}`);
    }

    return parts.join(" / ");
  }, [alarme, alarmStates, currentTemplate]);
  const templateRxGroups = useMemo(() => {
    return (currentTemplate.defaults.rxGroups ?? []).map((id) => RX_GROUP_MAP[id]).filter(Boolean);
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
    const anamnese = [
      `QP: ${qp}`,
      `TE: ${te}`,
      assoc ? `Associados: ${assoc}` : "",
      alarmLine ? `Sinais de alarme: ${alarmLine}` : "",
      comorb ? `Comorbidades: ${comorb}` : "",
      meds ? `Medicações de uso contínuo: ${meds}` : "",
      alergiaNega ? "Nega alergias" : ""
    ].filter(Boolean);

    const vitalsLine =
      !triagem && (pa || fc || sat)
        ? `PA ${pa || "___"} FC ${fc || "___"} Sat ${sat || "___"}`
        : triagem
          ? "Sinais vitais conforme triagem"
          : "";

    const exame = [
      "BEG, consciente e orientado, corado, hidratado",
      vitalsLine,
      "Coluna: dor à palpação paravertebral, sem deformidades aparentes",
      "Neuro: força e sensibilidade preservadas, sem déficit focal"
    ].filter(Boolean);

    const avaliacao = [hipotese].filter(Boolean);

    const conduta = [
      "Orientado sobre o quadro e conduta",
      `Orientado sinais de alarme: ${condutaAlarmes}`,
      "Retorno imediato se sinais de alarme ou piora do quadro",
      "Paciente esclarecido e de acordo com as orientações"
    ];

    return { anamnese, exame, hipotese: avaliacao, conduta };
  }, [qp, te, assoc, alarmLine, comorb, meds, alergiaNega, triagem, pa, fc, sat, hipotese, condutaAlarmes]);

  function formatBlock(key: BlockKey) {
    return blocks[key].join("\n");
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  function handleRestoreTemplateDefaults() {
    if (!currentTemplate) return;

    const defaults = buildTemplateDefaults(currentTemplate);
    isApplyingTemplate.current = true;
    setQp(defaults.qp);
    setTe(defaults.te);
    setAssoc(defaults.assoc);
    setAlarme(defaults.alarme);
    setComorb(defaults.comorb);
    setMeds(defaults.meds);
    setHipotese(defaults.hipotese);
    setCondutaAlarmes(defaults.condutaAlarmes);
    setAlarmStates(defaults.alarmStates);
    setRxSelected(defaults.rxSelected);
    isApplyingTemplate.current = false;

    savedTemplatesRef.current = { ...savedTemplatesRef.current, [templateId]: defaults };
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          templateId,
          templates: savedTemplatesRef.current
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
    setQp(defaults.qp);
    setTe(defaults.te);
    setAssoc(defaults.assoc);
    setAlarme(defaults.alarme);
    setComorb(defaults.comorb);
    setMeds(defaults.meds);
    setHipotese(defaults.hipotese);
    setCondutaAlarmes(defaults.condutaAlarmes);
    setAlarmStates(defaults.alarmStates);
    setRxSelected(defaults.rxSelected);
    setTriagem(true);
    setPa("");
    setFc("");
    setSat("");
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

  function handleToggleRx(id: string) {
    setRxSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((rx) => rx !== id);
      }
      return [...prev, id];
    });
  }

  const allText = `${formatBlock("anamnese")}\n\n${formatBlock("exame")}\n\n${formatBlock("hipotese")}\n\n${formatBlock("conduta")}`;

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>MVP Prontuário (blocos)</h1>

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

          <label>QP<br /><input value={qp} onChange={(e) => setQp(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <label>TE<br /><input value={te} onChange={(e) => setTe(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <label>Associados<br /><input value={assoc} onChange={(e) => setAssoc(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          {hasAlarmItems ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Sinais de alarme</div>
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
                        padding: "8px 12px",
                        border: `1px solid ${ALARM_STATUS_STYLES[status].border}`,
                        background: ALARM_STATUS_STYLES[status].background,
                        color: ALARM_STATUS_STYLES[status].color,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "none"
                      }}
                    >
                      <span>{item.label}</span>
                      <span style={{ fontSize: 12, opacity: 0.9 }}>({statusLabel})</span>
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

          <label>Comorbidades (linha)<br /><input value={comorb} onChange={(e) => setComorb(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
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

          <textarea readOnly value={allText} style={{ width: "100%", height: 420, fontFamily: "ui-monospace, SFMono-Regular", whiteSpace: "pre", padding: 12 }} />
        </section>
      </div>

      <section className="no-print" style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Receituário</h2>
        {templateRxGroups.length === 0 && <p style={{ margin: "4px 0 0", color: "#666" }}>Template sem grupos de receita.</p>}
        {templateRxGroups.map((group) => (
          <div key={group.id} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>{group.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.itemIds.map((itemId) => {
                const item = RX_CATALOG_MAP[itemId];
                if (!item) return null;
                const checked = rxSelected.includes(itemId);
                return (
                  <label key={itemId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={checked} onChange={() => handleToggleRx(itemId)} />
                    <span>{item.label} <span style={{ color: "#666", fontSize: 12 }}>({item.route})</span></span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => copy(rxText || "Sem itens selecionados")} disabled={!rxText}>
            Copiar receita
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
        {rxText && (
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
