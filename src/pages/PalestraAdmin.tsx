import { useEffect, useState } from "react";
import type { PalestraEntry } from "../lib/palestra/api";

const EDIT_KEY_STORE = "palestra-edit-key";

type FormState = {
  slug: string;
  titulo: string;
  cliente: string;
  data: string;
  thumbnail: string;
  status: "publicado" | "nao-listado";
  senha: string;
};

const EMPTY_FORM: FormState = {
  slug: "", titulo: "", cliente: "", data: "", thumbnail: "", status: "nao-listado", senha: ""
};

export default function PalestraAdmin() {
  const [key, setKey] = useState<string | null>(() => sessionStorage.getItem(EDIT_KEY_STORE));
  const [decks, setDecks] = useState<PalestraEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function loadDecks() {
    const res = await fetch("/api/deck-registry", { cache: "no-store" });
    const data = await res.json();
    setDecks(Array.isArray(data.decks) ? data.decks : []);
  }

  useEffect(() => {
    if (key) loadDecks().catch((e) => setError(String(e.message || e)));
  }, [key]);

  async function requestKey() {
    const k = window.prompt("Chave de edição:");
    if (!k) return;
    const res = await fetch("/api/deck-registry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: k, slug: "__verify__", titulo: "" }),
    });
    // slug inválido sempre retorna 400 com chave certa, ou 401 com chave errada —
    // então só o status 401 indica chave incorreta.
    if (res.status === 401) { window.alert("Chave incorreta."); return; }
    sessionStorage.setItem(EDIT_KEY_STORE, k);
    setKey(k);
  }

  async function addDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!key) return;
    const res = await fetch("/api/deck-registry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, ...form }),
    });
    const out = await res.json();
    if (!res.ok) { window.alert(out.error || "Erro ao criar a palestra."); return; }
    setForm(EMPTY_FORM);
    loadDecks();
  }

  async function toggleStatus(deck: PalestraEntry) {
    if (!key) return;
    const nextStatus = deck.status === "publicado" ? "nao-listado" : "publicado";
    await fetch(`/api/deck-registry/${deck.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, status: nextStatus }),
    });
    loadDecks();
  }

  async function removeDeck(deck: PalestraEntry) {
    if (!key) return;
    if (!window.confirm(`Remover a palestra "${deck.titulo}"? Isso apaga o conteúdo dela também.`)) return;
    await fetch(`/api/deck-registry/${deck.slug}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });
    loadDecks();
  }

  if (!key) {
    return (
      <div className="container mx-auto px-6 py-16">
        <p className="text-foreground/70">Painel restrito.</p>
        <button
          onClick={requestKey}
          className="mt-4 rounded-md border border-white/20 px-4 py-2 text-sm text-foreground hover:border-neon/40"
        >
          Entrar com a chave de edição
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-foreground mb-8">Gerenciar palestras</h1>
      {error && <p className="text-foreground/70">{error}</p>}

      <form onSubmit={addDeck} className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input required placeholder="slug (ex: acme)" value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input required placeholder="título" value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input placeholder="cliente" value={form.cliente}
          onChange={(e) => setForm({ ...form, cliente: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input placeholder="data (2026-09-09)" value={form.data}
          onChange={(e) => setForm({ ...form, data: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input placeholder="thumbnail (URL)" value={form.thumbnail}
          onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <input placeholder="senha de acesso (opcional)" value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground" />
        <select value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}
          className="rounded-md border border-white/20 bg-transparent px-3 py-2 text-foreground">
          <option value="nao-listado">Não-listado</option>
          <option value="publicado">Publicado</option>
        </select>
        <button type="submit"
          className="rounded-md border border-white/20 px-4 py-2 text-sm text-foreground hover:border-neon/40">
          Adicionar palestra
        </button>
      </form>

      <ul className="divide-y divide-white/10">
        {(decks || []).map((deck) => (
          <li key={deck.slug} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-foreground">{deck.titulo} <span className="text-foreground/50">({deck.slug})</span></p>
              <p className="text-xs text-foreground/50">
                {deck.status}{deck.senhaHash ? " · com senha" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <a href={`/palestra/${deck.slug}?edit=1`} className="text-sm text-neon hover:underline">editar</a>
              <button onClick={() => toggleStatus(deck)} className="text-sm text-foreground/70 hover:underline">
                {deck.status === "publicado" ? "despublicar" : "publicar"}
              </button>
              <button onClick={() => removeDeck(deck)} className="text-sm text-red-400 hover:underline">remover</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
