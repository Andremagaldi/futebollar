"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import BottomNav from "@/components/layout/BottomNav";

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

// ── Sub-componentes ────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    aprovado: {
      label: "✓ Aprovado",
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-400",
    },
    pendente: {
      label: "⏳ Pendente",
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-400",
    },
    bloqueado: {
      label: "✕ Bloqueado",
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
    },
  };
  const s = map[status] ?? {
    label: status,
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-500",
  };
  return (
    <span
      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

function formatCategoria(c: string) {
  return c === "convidado" ? "Convidado" : "Membro";
}
function formatTipo(t: string) {
  return t === "mensalista" ? "Mensalista" : "Avulso";
}

// ── Página principal ───────────────────────────────────────

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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

  // ── Loading ──
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  // ── Erro ──
  if (!profile)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-8 text-center">
        <div>
          <p className="text-4xl mb-3">😕</p>
          <p className="font-semibold text-gray-700 dark:text-gray-300">
            {erro ?? "Perfil não encontrado."}
          </p>
        </div>
      </div>
    );

  const iniciais = profile.nome_completo
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const isMens = profile.tipo === "mensalista";

  return (
    <div className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-950">
      <PageHeader title="MEU PERFIL" showBack />

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* ── Hero card ── */}
        <div className="rounded-3xl p-5 relative overflow-hidden bg-gradient-to-br from-blue-700 to-blue-900 shadow-xl">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white opacity-10" />
          <div className="absolute right-16 -bottom-10 w-28 h-28 rounded-full bg-white opacity-10" />

          <div className="relative z-10 flex items-center gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/20">
              {profile.foto_url ? (
                <img
                  src={profile.foto_url}
                  alt={profile.nome_completo}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/15 backdrop-blur-sm flex items-center justify-center font-bold text-2xl text-white">
                  {iniciais}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-display text-2xl text-white leading-tight truncate">
                {profile.nome_completo.split(" ")[0].toUpperCase()}
              </p>
              <p className="text-white/60 text-sm mt-0.5 truncate">
                {profile.nome_completo}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isMens
                      ? "bg-yellow-400/20 text-yellow-300"
                      : "bg-white/15 text-white/80"
                  }`}
                >
                  {isMens ? "📅 Mensalista" : "💳 Avulso"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/15 text-white/80">
                  {formatCategoria(profile.categoria)}
                </span>
                <StatusBadge status={profile.status} />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="relative z-10 grid grid-cols-3 gap-2 mt-5">
            {[
              { label: "Stars", value: profile.stars, icon: "⭐" },
              { label: "MVPs", value: profile.mvp_count, icon: "🏅" },
              {
                label: "Posição",
                value: profile.posicao === "goleiro" ? "🧤" : "⚽",
                icon: null,
              },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                className="rounded-2xl p-3 text-center bg-white/10"
              >
                <p className="text-lg">{icon ?? value}</p>
                <p className="font-display text-xl text-white leading-none mt-1">
                  {icon
                    ? value
                    : profile.posicao === "goleiro"
                      ? "Goleiro"
                      : "Linha"}
                </p>
                <p className="text-white/50 text-[10px] mt-0.5 uppercase tracking-wider">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {profile.is_admin && (
            <div className="relative z-10 mt-3 flex justify-center">
              <span className="text-xs px-3 py-1 rounded-full bg-yellow-400/20 text-yellow-300 font-semibold tracking-wide">
                ⚙️ Administrador
              </span>
            </div>
          )}
        </div>

        {/* ── Formulário editável ── */}
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Editar informações
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* WhatsApp */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                📱 WhatsApp
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1">
                Usado para receber lembretes de pagamento
              </p>
            </div>

            {/* Posição */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                🎽 Posição
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["linha", "goleiro"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPosicao(p)}
                    className={`py-3 rounded-xl text-sm font-semibold transition-all border active:scale-95 ${
                      posicao === p
                        ? "bg-blue-600 border-blue-600 text-white shadow-md"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {p === "goleiro" ? "🧤 Goleiro" : "⚽ Linha"}
                  </button>
                ))}
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
                <span className="text-sm text-red-600 dark:text-red-400">
                  {erro}
                </span>
              </div>
            )}

            {/* Botão salvar */}
            <button
              onClick={salvar}
              disabled={salvando}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 ${
                salvo
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {salvando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : salvo ? (
                "✓ Salvo com sucesso!"
              ) : (
                "Salvar alterações"
              )}
            </button>
          </div>
        </div>

        {/* ── Info somente leitura ── */}
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Informações da conta
            </p>
          </div>
          <div className="px-4">
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
        </div>

        {/* ── Logout ── */}
        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl font-semibold text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 active:scale-[0.98] transition-all"
        >
          Sair da conta
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
