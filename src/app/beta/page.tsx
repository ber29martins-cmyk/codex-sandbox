"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BETA_STORAGE_KEY = "beta_access_v2";
const LEGACY_BETA_STORAGE_KEY = "beta_access_v1";

type BetaResponse =
  | { ok: true; label?: string; emailHash?: string }
  | { ok: false; reason?: string };

export default function BetaPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    const hydrate = async () => {
      setLoading(true);
      try {
        const legacy = localStorage.getItem(LEGACY_BETA_STORAGE_KEY);
        if (legacy) localStorage.removeItem(LEGACY_BETA_STORAGE_KEY);

        const stored = localStorage.getItem(BETA_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { code?: string; emailHash?: string };
          if (parsed?.code && parsed?.emailHash) {
            const res = await fetch("/api/beta/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: parsed.code, emailHash: parsed.emailHash })
            });
            const json = (await res.json()) as BetaResponse;
            if (cancelled) return;
            if (res.ok && json.ok) {
              router.replace("/");
              return;
            }
            localStorage.removeItem(BETA_STORAGE_KEY);
            setError((!json.ok && json.reason) || "invalid");
          } else {
            localStorage.removeItem(BETA_STORAGE_KEY);
          }
        }
      } catch (err) {
        if (!cancelled) setError("invalid");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cleanCode = code.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanCode) {
      setError("invalid");
      return;
    }
    if (!cleanEmail) {
      setError("invalid_email");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/beta/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode, email: cleanEmail })
      });
      const json = (await res.json()) as BetaResponse & { emailHash?: string };
      if (res.ok && json.ok) {
        localStorage.setItem(BETA_STORAGE_KEY, JSON.stringify({ code: cleanCode, emailHash: json.emailHash, ts: Date.now() }));
        router.replace("/");
      } else {
        localStorage.removeItem(BETA_STORAGE_KEY);
        setError((!json.ok && json.reason) || "invalid");
      }
    } catch (err) {
      setError("invalid");
    } finally {
      setLoading(false);
    }
  }

  const buttonDisabled = loading;

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Beta fechado</h1>
        <p style={{ color: "#4b5563", marginBottom: 16 }}>Digite seu código de acesso e e-mail para entrar.</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de acesso"
            disabled={buttonDisabled}
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            disabled={buttonDisabled}
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
          />
          <button
            type="submit"
            disabled={buttonDisabled}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: buttonDisabled ? "#93c5fd" : "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: buttonDisabled ? "not-allowed" : "pointer"
            }}
          >
            {buttonDisabled ? "Validando..." : "Entrar"}
          </button>
          {error && (
            <div style={{ color: "#b91c1c", fontSize: 13 }}>
              {error === "invalid_email"
                ? "Informe um e-mail válido."
                : error === "expired"
                  ? "Código expirado."
                  : error === "revoked"
                    ? "Código revogado."
                    : error === "bound_to_other_email"
                      ? "Este código já foi ativado com outro e-mail."
                      : error === "not_activated"
                        ? "Ative o código com seu e-mail para continuar."
                        : error === "kv_not_configured"
                          ? "Serviço de acesso indisponível no momento."
                          : "Código inválido."}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
