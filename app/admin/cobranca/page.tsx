"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";

const CHAVE_PIX = "futebollarcristo@email.com"; // ← troque pela sua chave PIX

interface Devedor {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  tipo: string;
  multa_aplicada: boolean;
  ultima_cobranca: string | null;
}

function formatTipo(tipo: string) {
  const map: Record<string, string> = {
    mensalista_membro: "Mensalista",
    mensalista_convidado: "Mensalista Convidado",
    avulso_membro: "Avulso",
    avulso_convidado: "Avulso Convidado",
    mensalista: "Mensalista",
    avulso: "Avulso",
  };
  return map[tipo] ?? tipo;
}

function formatRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}

export default function CobrancaPage() {
  const router = useRouter();
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);

  useEffect(() => {
    loadAdminAndData();
  }, []);

  async function loadAdminAndData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }
    setAdminId(user.id);
    await loadDevedores();
  }

  async function loadDevedores() {
    setLoading(true);
    const { data: game } = await supabase
      .from("games")
      .select("id")
      .order("data_jogo", { ascending: false })
      .limit(1)
      .single();

    if (!game) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("game_players")
      .select(
        `id, user_id, tipo, multa_aplicada, users(nome_completo, telefone), cobrancas_log(enviado_em)`,
      )
      .eq("game_id", game.id)
      .eq("status", "confirmado")
      .eq("payment_status", "pendente")
      .order("criado_em");

    if (!data) {
      setLoading(false);
      return;
    }

    setDevedores(
      data.map((d) => {
        const logs = (d.cobrancas_log as { enviado_em: string }[]) ?? [];
        const ultima =
          logs.length > 0
            ? logs.sort(
                (a, b) =>
                  new Date(b.enviado_em).getTime() -
                  new Date(a.enviado_em).getTime(),
              )[0].enviado_em
            : null;
        return {
          id: d.id,
          user_id: d.user_id,
          nome:
            (
              d.users as {
                nome_completo: string;
                telefone: string | null;
              } | null
            )?.nome_completo ?? "—",
          telefone:
            (
              d.users as {
                nome_completo: string;
                telefone: string | null;
              } | null
            )?.telefone ?? null,
          tipo: d.tipo,
          multa_aplicada: d.multa_aplicada,
          ultima_cobranca: ultima,
        };
      }),
    );
    setLoading(false);
  }

  function montarMensagem(devedor: Devedor, tom: "gentil" | "serio"): string {
    const multa = devedor.multa_aplicada ? " (com multa de 20%)" : "";
    const nome = devedor.nome.split(" ")[0];
    if (tom === "gentil")
      return `Olá ${nome}! 😊 Passando para lembrar que seu pagamento do futebol de sábado ainda está pendente${multa}. Chave PIX: ${CHAVE_PIX} 🙏`;
    return `${nome}, seu pagamento do futebol ainda NÃO foi confirmado${multa}. Por favor regularize o quanto antes! Chave PIX: ${CHAVE_PIX} ⚽`;
  }

  function formatarTelefone(tel: string): string {
    const nums = tel.replace(/\D/g, "");
    return nums.startsWith("55") ? nums : `55${nums}`;
  }

  async function cobrar(devedor: Devedor, tom: "gentil" | "serio") {
    setEnviando(devedor.id + tom);
    const mensagem = montarMensagem(devedor, tom);
    const msgEncoded = encodeURIComponent(mensagem);

    if (adminId) {
      await supabase.rpc("registrar_cobranca", {
        p_game_player_id: devedor.id,
        p_admin_id: adminId,
        p_tipo: tom,
      });
    }

    const url = devedor.telefone
      ? `https://wa.me/${formatarTelefone(devedor.telefone)}?text=${msgEncoded}`
      : `https://wa.me/?text=${msgEncoded}`;
    window.open(url, "_blank");

    await loadDevedores();
    setEnviando(null);
  }

  const semTelefone = devedores.some((d) => !d.telefone);

  return (
    <ProtectedRoute requiredRole="gerente">
      <div className="min-h-screen pb-28 bg-gray-50 dark:bg-gray-950">
        {/* ── Header ── */}
        <header className="sticky top-0 z-40 px-4 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 active:scale-95 transition-all"
            >
              ←
            </button>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest">
                Admin
              </p>
              <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
                COBRANÇAS
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                {devedores.length} pendente{devedores.length !== 1 ? "s" : ""}
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : devedores.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-5xl mb-4">🎉</p>
              <p className="font-display text-2xl text-gray-900 dark:text-white">
                TODOS PAGARAM!
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Nenhum pagamento pendente
              </p>
            </div>
          ) : (
            <>
              {devedores.map((d) => (
                <div
                  key={d.id}
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden"
                >
                  {/* Info */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">
                          {d.nome}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {formatTipo(d.tipo)}
                        </p>
                        {d.telefone ? (
                          <p className="text-gray-400 text-xs mt-0.5">
                            📱 {d.telefone}
                          </p>
                        ) : (
                          <p className="text-amber-500 text-xs mt-0.5">
                            ⚠️ Sem telefone cadastrado
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        {d.multa_aplicada && (
                          <span className="inline-block bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                            +20% multa
                          </span>
                        )}
                        {d.ultima_cobranca && (
                          <p className="text-gray-400 text-xs">
                            Cobrado {formatRelativo(d.ultima_cobranca)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botões */}
                  <div className="border-t border-gray-100 dark:border-gray-800 grid grid-cols-2">
                    <button
                      onClick={() => cobrar(d, "gentil")}
                      disabled={!!enviando}
                      className="py-3 flex items-center justify-center gap-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 text-sm font-semibold transition-colors disabled:opacity-50 border-r border-gray-100 dark:border-gray-800 active:scale-95"
                    >
                      {enviando === d.id + "gentil" ? (
                        <Spinner />
                      ) : (
                        <>😊 Gentil</>
                      )}
                    </button>
                    <button
                      onClick={() => cobrar(d, "serio")}
                      disabled={!!enviando}
                      className="py-3 flex items-center justify-center gap-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 text-sm font-semibold transition-colors disabled:opacity-50 active:scale-95"
                    >
                      {enviando === d.id + "serio" ? (
                        <Spinner />
                      ) : (
                        <>😤 Sério</>
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {/* Aviso sem telefone */}
              {semTelefone && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-4 text-sm text-amber-700 dark:text-amber-400">
                  💡 Jogadores sem telefone vão abrir o WhatsApp sem número —
                  você digita manualmente. Cadastre o telefone no perfil de cada
                  jogador.
                </div>
              )}
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
