import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface SessionResponse {
  question_idx: number;
  question_text: string;
  answer_text: string;
  indexed: boolean;
  published: boolean;
}
interface Session {
  session_id: string;
  created_at: string;
  responses: SessionResponse[];
}
interface ListResponse {
  sessions: Session[];
  totalSessions: number;
  totalResponses: number;
}

export default function AerolitoAdmin() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [data, setData] = useState<ListResponse | null>(null);
  const [bulletsDraft, setBulletsDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState("");

  async function authFetch(input: string, init?: RequestInit): Promise<Response> {
    return fetch(input, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
  }

  async function loadList() {
    setBusy("Carregando…");
    try {
      const r = await authFetch("/api/aerolito-admin?action=list");
      if (!r.ok) throw new Error(`status ${r.status}`);
      const d = await r.json() as ListResponse;
      setData(d);
    } catch (e) {
      setMsg(`Erro ao listar: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }

  async function consolidate() {
    setBusy("Gerando bullets…");
    try {
      const r = await authFetch("/api/aerolito-admin?action=consolidate", { method: "POST" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const d = await r.json() as { bullets: string[] };
      setBulletsDraft(d.bullets.join("\n"));
    } catch (e) {
      setMsg(`Erro ao consolidar: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }

  async function publish() {
    setBusy("Publicando…");
    try {
      const list = bulletsDraft.split("\n").map((s) => s.trim()).filter(Boolean);
      const r = await authFetch("/api/aerolito-admin?action=publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullets: list }),
      });
      if (!r.ok) {
        const errBody = await r.text();
        throw new Error(`status ${r.status}: ${errBody}`);
      }
      setMsg("Publicado! O card já aparece em todas as locales na trajetória.");
    } catch (e) {
      setMsg(`Erro ao publicar: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }

  async function downloadBackup() {
    setBusy("Exportando backup…");
    try {
      const r = await authFetch("/api/aerolito-admin?action=reset", { method: "POST" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const d = await r.json() as { backup: unknown };
      const blob = new Blob([JSON.stringify(d.backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aerolito-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Reset concluído e backup baixado.");
      await loadList();
    } catch (e) {
      setMsg(`Erro no reset: ${(e as Error).message}`);
    } finally { setBusy(null); }
  }

  useEffect(() => { if (token) loadList(); }, [token]);

  if (!token) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">Não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        <header>
          <h1 className="font-display text-3xl uppercase tracking-tight">Aerolito Admin</h1>
          {busy && <p className="font-mono text-xs text-neon mt-2">{busy}</p>}
          {msg && <p className="font-mono text-xs text-muted-foreground mt-2">{msg}</p>}
        </header>

        <section>
          <h2 className="font-display text-xl uppercase tracking-tight mb-4">
            1. Respostas recebidas {data && <span className="text-neon">({data.totalSessions} sessões · {data.totalResponses} respostas)</span>}
          </h2>
          {!data ? <p className="font-mono text-xs text-muted-foreground">Carregando…</p> : data.sessions.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">Sem respostas ainda.</p>
          ) : (
            <div className="space-y-4">
              {data.sessions.map((s, i) => (
                <details key={s.session_id} className="border border-border rounded-md p-3 bg-card/40">
                  <summary className="font-mono text-[11px] uppercase tracking-wider text-foreground cursor-pointer">
                    Sessão {i + 1} · {new Date(s.created_at).toLocaleString("pt-BR")} · {s.responses.length}/5
                  </summary>
                  <ol className="mt-3 space-y-2">
                    {s.responses.map((r) => (
                      <li key={r.question_idx} className="text-[12px]">
                        <p className="text-muted-foreground"><strong>Q{r.question_idx}:</strong> {r.question_text}</p>
                        <p className="text-foreground mt-1">R: {r.answer_text}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl uppercase tracking-tight mb-4">2. Consolidação</h2>
          <button onClick={consolidate} className="font-mono text-[11px] uppercase tracking-wider border border-neon/40 text-neon px-3 py-2 rounded-sm hover:bg-neon/10">
            Gerar proposta de bullets com IA
          </button>
          <textarea
            value={bulletsDraft}
            onChange={(e) => setBulletsDraft(e.target.value)}
            placeholder="Um bullet por linha (4 a 6 linhas). Cada um até 200 caracteres."
            className="mt-4 w-full h-40 bg-background border border-border rounded-md px-3 py-2 text-[13px] font-sans focus:outline-none focus:border-neon/40"
          />
          {bulletsDraft.trim() && (
            <div className="mt-4 border border-border rounded-md p-4 bg-card/40">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Preview do card na trajetória</p>
              <h3 className="font-display font-semibold text-foreground text-[17px] uppercase tracking-tight">Head de Pesquisa</h3>
              <p className="font-sans text-electric text-[14px]">Aeroli.to · JUN 2026 — presente · Porto Alegre, RS</p>
              <ul className="mt-2 space-y-1">
                {bulletsDraft.split("\n").map((b, i) => b.trim() && (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-muted-foreground"><span className="text-neon mt-1.5 text-[6px]">●</span>{b.trim()}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={publish} disabled={!bulletsDraft.trim()} className="mt-4 font-mono text-[11px] uppercase tracking-wider bg-neon text-background px-3 py-2 rounded-sm disabled:opacity-30">
            Publicar na trajetória
          </button>
        </section>

        <section>
          <h2 className="font-display text-xl uppercase tracking-tight mb-4">3. Reset</h2>
          <p className="font-mono text-xs text-muted-foreground mb-3">
            Apaga TUDO (Supabase + vector store + bullets publicados). Backup é exportado automaticamente antes.
          </p>
          <input
            type="text"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder='Digite "RESETAR" para liberar o botão'
            className="bg-background border border-border rounded-md px-3 py-2 text-[13px] font-sans"
          />
          <button onClick={downloadBackup} disabled={resetConfirm !== "RESETAR"} className="ml-3 font-mono text-[11px] uppercase tracking-wider border border-destructive/60 text-destructive px-3 py-2 rounded-sm disabled:opacity-20">
            Resetar tudo (com backup)
          </button>
        </section>
      </section>
    </main>
  );
}
