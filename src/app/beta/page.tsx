"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isInviteValid } from "../../lib/invite";

export default function BetaPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("invite_code");
    if (isInviteValid(saved)) {
      router.replace("/");
    }
  }, [router]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isInviteValid(code)) {
      setError("Código inválido. Verifique e tente novamente.");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("invite_code", code.trim());
    }
    router.replace("/");
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Beta fechado</h1>
        <p style={{ color: "#4b5563", marginBottom: 16 }}>Digite seu código de convite para acessar.</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de convite"
            style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
          />
          <button type="submit" style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Entrar
          </button>
          {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
        </form>
      </div>
    </main>
  );
}
