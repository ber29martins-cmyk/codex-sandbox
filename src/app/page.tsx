"use client";

import { useEffect, useMemo, useState } from "react";

type BlockKey = "anamnese" | "exame" | "hipotese" | "conduta";
type AlarmState = "unknown" | "negative" | "positive";
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
  };
};

import templatesData from "../templates/templates.json";
const TEMPLATES = (templatesData as { templates: Template[] }).templates;

export default function Page() {
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]?.id ?? "lombalgia");
  const currentTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0],
    [templateId]
  );
  const alarmItems = currentTemplate?.defaults.alarmItems ?? [];
  const hasAlarmItems = alarmItems.length > 0;

  const [qp, setQp] = useState("Dor lombar");
  const [te, setTe] = useState("3 dias");
  const [assoc, setAssoc] = useState("Sem irradiação, sem trauma");
  const [alarme, setAlarme] = useState("Nega perda de força, anestesia em sela e alteração esfincteriana");
  const [comorb, setComorb] = useState("DM NIR, HAS");
  const [meds, setMeds] = useState("Metformina 500mg 1-0-1 + Losartana 50mg 1-0-1");
  const [alergiaNega, setAlergiaNega] = useState(true);
  const [alarmStatuses, setAlarmStatuses] = useState<Record<string, AlarmState>>({});

  useEffect(() => {
    if (!currentTemplate) return;

    setQp(currentTemplate.defaults.qp);
    setTe(currentTemplate.defaults.te);
    setAssoc(currentTemplate.defaults.assoc);
    setAlarme(currentTemplate.defaults.alarme);
    setComorb(currentTemplate.defaults.comorb);
    setMeds(currentTemplate.defaults.meds);
    setHipotese(currentTemplate.defaults.hipotese);
    setCondutaAlarmes(currentTemplate.defaults.condutaAlarmes);
    setAlarmStatuses(
      (currentTemplate.defaults.alarmItems ?? []).reduce((acc, item) => {
        acc[item.key] = "unknown";
        return acc;
      }, {} as Record<string, AlarmState>)
    );
  }, [templateId, currentTemplate]);

  const [triagem, setTriagem] = useState(true);
  const [pa, setPa] = useState("");
  const [fc, setFc] = useState("");
  const [sat, setSat] = useState("");

  const [hipotese, setHipotese] = useState("Lombalgia");
  const [condutaAlarmes, setCondutaAlarmes] = useState(
    "Perda de força em MMII, anestesia em sela, retenção urinária/incontinência"
  );

  const alarmLine = useMemo(() => {
    if (!hasAlarmItems) {
      return `Sinais de alarme: ${alarme}`;
    }

    const buckets: Record<AlarmState, string[]> = {
      negative: [],
      positive: [],
      unknown: []
    };

    alarmItems.forEach((item) => {
      const state = alarmStatuses[item.key] ?? "unknown";
      buckets[state].push(item.label);
    });

    const parts = [
      buckets.negative.length ? `Nega ${buckets.negative.join(", ")}` : "",
      buckets.positive.length ? `Presente ${buckets.positive.join(", ")}` : "",
      buckets.unknown.length ? `Não avaliado ${buckets.unknown.join(", ")}` : ""
    ].filter(Boolean);

    return `Sinais de alarme: ${parts.join("; ")}`;
  }, [alarme, alarmItems, alarmStatuses, hasAlarmItems]);

  const alarmStateLabel: Record<AlarmState, string> = {
    negative: "Nega",
    positive: "Presente",
    unknown: "Não avaliado"
  };

  const alarmStateStyles: Record<AlarmState, { background: string; color: string; border: string }> = {
    negative: { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" },
    positive: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecdd3" },
    unknown: { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }
  };

  const toggleAlarmState = (key: string) => {
    setAlarmStatuses((prev) => {
      const current = prev[key] ?? "unknown";
      const next = current === "unknown" ? "negative" : current === "negative" ? "positive" : "unknown";
      return { ...prev, [key]: next };
    });
  };

  const blocks = useMemo(() => {
    const anamnese = [
      `QP: ${qp}`,
      `TE: ${te}`,
      assoc ? `Associados: ${assoc}` : "",
      alarmLine,
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
  }, [alarmLine, alergiaNega, assoc, comorb, condutaAlarmes, fc, hipotese, meds, pa, qp, sat, te, triagem]);

  function formatBlock(key: BlockKey) {
    return blocks[key].join("\n");
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  const allText = `${formatBlock("anamnese")}\n\n${formatBlock("exame")}\n\n${formatBlock("hipotese")}\n\n${formatBlock("conduta")}`;

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>MVP Prontuário (blocos)</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
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

          <label>QP<br /><input value={qp} onChange={(e) => setQp(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <label>TE<br /><input value={te} onChange={(e) => setTe(e.target.value)} style={{ width: "100%" }} /></label><br /><br />
          <label>Associados<br /><input value={assoc} onChange={(e) => setAssoc(e.target.value)} style={{ width: "100%" }} /></label><br /><br />

          {hasAlarmItems && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Sinais de alarme</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {alarmItems.map((item) => {
                  const state = alarmStatuses[item.key] ?? "unknown";
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleAlarmState(item.key)}
                      style={{
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontSize: 13,
                        cursor: "pointer",
                        ...alarmStateStyles[state]
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{item.label}</span>
                      <span style={{ marginLeft: 8, fontSize: 12 }}>({alarmStateLabel[state]})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label>
            Sinais de alarme (linha)
            <br />
            <input
              value={alarmLine}
              readOnly={hasAlarmItems}
              onChange={!hasAlarmItems ? (e) => setAlarme(e.target.value) : undefined}
              style={{ width: "100%" }}
            />
          </label>
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
          </div>

          <textarea readOnly value={allText} style={{ width: "100%", height: 420, fontFamily: "ui-monospace, SFMono-Regular", whiteSpace: "pre", padding: 12 }} />
        </section>
      </div>

      <p style={{ color: "#666", fontSize: 13 }}>
        Próximo passo: transformar “Sinais de alarme” em tri-state e carregar templates (resfriado/gripe/lombalgia/gastro/sinusite) via JSON.
      </p>
    </main>
  );
}
