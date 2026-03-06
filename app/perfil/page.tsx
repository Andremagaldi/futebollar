"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  nome_completo: string;
  telefone: string | null;
  foto_url: string | null;
  posicao: string;
  categoria: string;
  tipo: string;
  stars: number;
  mvp_count: number;
  status: string;
  is_admin: boolean;
}

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Campos editáveis
  const [telefone, setTelefone] = useState("");
  const [posicao, setPosicao] = useState("linha");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      setErro("Não foi possível carregar o perfil.");
      setLoading(false);
      return;
    }

    setProfile(data);
    setTelefone(data.telefone ?? "");
    setPosicao(data.posicao ?? "linha");
    setLoading(false);
  }

  async function salvar() {
    if (!profile) return;
    setSalvando(true);
    setErro(null);

    const { error } = await supabase
      .from("users")
      .update({ telefone: telefone || null, posicao })
      .eq("id", profile.id);

    if (error) {
      setErro("Erro ao salvar. Tente novamente.");
    } else {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
      await loadProfile();
    }
    setSalvando(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center text-green-400">
        {erro ?? "Perfil não encontrado."}
      </div>
    );
  }

  const iniciais = profile.nome_completo
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-green-950 text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-green-400 text-sm mb-3 flex items-center gap-1 hover:text-green-300"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
        </div>

        {/* Avatar + nome */}
        <div className="bg-green-900/40 border border-green-800/40 rounded-2xl p-6 mb-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-green-700 flex items-center justify-center text-2xl font-bold flex-shrink-0 overflow-hidden">
            {profile.foto_url ? (
              <img
                src={profile.foto_url}
                alt={profile.nome_completo}
                className="w-full h-full object-cover"
              />
            ) : (
              iniciais
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">
              {profile.nome_completo}
            </p>
            <p className="text-green-400 text-sm">
              {formatCategoria(profile.categoria)} · {formatTipo(profile.tipo)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <StatusBadge status={profile.status} />
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div
          className={`grid gap-3 mb-4 ${profile.is_admin ? "grid-cols-3" : "grid-cols-2"}`}
        >
          {profile.is_admin && (
            <div className="bg-green-900/40 border border-green-800/40 rounded-xl p-3 text-center">
              <p className="text-yellow-400 text-xl font-bold">
                {"⭐".repeat(profile.stars) || "—"}
              </p>
              <p className="text-green-500 text-xs mt-1">
                {profile.stars} estrela{profile.stars !== 1 ? "s" : ""}
              </p>
            </div>
          )}
          <div className="bg-green-900/40 border border-green-800/40 rounded-xl p-3 text-center">
            <p className="text-yellow-300 text-xl font-bold">
              {profile.mvp_count}
            </p>
            <p className="text-green-500 text-xs mt-1">
              MVP{profile.mvp_count !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="bg-green-900/40 border border-green-800/40 rounded-xl p-3 text-center">
            <p className="text-2xl">
              {profile.posicao === "goleiro" ? "🧤" : "⚽"}
            </p>
            <p className="text-green-500 text-xs mt-1">
              {profile.posicao === "goleiro" ? "Goleiro" : "Linha"}
            </p>
          </div>
        </div>

        {/* Formulário editável */}
        <div className="bg-green-900/40 border border-green-800/40 rounded-2xl p-5 mb-4 space-y-4">
          <p className="text-green-400 text-sm font-semibold">
            Editar informações
          </p>

          {/* Telefone */}
          <div>
            <label className="text-green-500 text-xs mb-1.5 block">
              📱 WhatsApp
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full bg-green-950 border border-green-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-green-700 focus:outline-none focus:border-green-500 transition-colors"
            />
            <p className="text-green-700 text-xs mt-1">
              Usado para receber lembretes de pagamento
            </p>
          </div>

          {/* Posição */}
          <div>
            <label className="text-green-500 text-xs mb-1.5 block">
              🎽 Posição
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["linha", "goleiro"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPosicao(p)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                    posicao === p
                      ? "bg-green-700 border-green-600 text-white"
                      : "bg-green-950 border-green-800 text-green-400 hover:border-green-600"
                  }`}
                >
                  {p === "goleiro" ? "🧤 Goleiro" : "⚽ Linha"}
                </button>
              ))}
            </div>
          </div>

          {/* Erro */}
          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          {/* Botão salvar */}
          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-green-600 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {salvando ? (
              <>
                <Spinner /> Salvando...
              </>
            ) : salvo ? (
              "✓ Salvo com sucesso!"
            ) : (
              "Salvar alterações"
            )}
          </button>
        </div>

        {/* Info somente leitura */}
        <div className="bg-green-900/20 border border-green-900/40 rounded-2xl p-5 mb-6 space-y-3">
          <p className="text-green-600 text-xs font-semibold uppercase tracking-wider">
            Informações da conta
          </p>
          <InfoRow
            label="Categoria"
            value={formatCategoria(profile.categoria)}
          />
          <InfoRow label="Tipo" value={formatTipo(profile.tipo)} />
          <InfoRow
            label="Posição"
            value={
              profile.posicao === "goleiro" ? "Goleiro" : "Jogador de Linha"
            }
          />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full border border-red-800/50 text-red-400 hover:bg-red-900/20 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-green-600 text-sm">{label}</span>
      <span className="text-green-300 text-sm font-medium">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    aprovado: { label: "✓ Aprovado", class: "bg-green-800/60 text-green-300" },
    pendente: {
      label: "⏳ Pendente",
      class: "bg-yellow-800/60 text-yellow-300",
    },
    bloqueado: { label: "✕ Bloqueado", class: "bg-red-800/60 text-red-300" },
  };
  const s = map[status] ?? {
    label: status,
    class: "bg-green-900 text-green-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.class}`}>
      {s.label}
    </span>
  );
}

function formatCategoria(categoria: string) {
  return categoria === "convidado" ? "Convidado" : "Membro";
}

function formatTipo(tipo: string) {
  return tipo === "mensalista" ? "Mensalista" : "Avulso";
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}
