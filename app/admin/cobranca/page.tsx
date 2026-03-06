"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface Devedor {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  tipo: string;
  multa_aplicada: boolean;
  ultima_cobranca: string | null;
}

const CHAVE_PIX = "futebollarcristo@email.com"; // ← troque pela sua chave PIX

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
      router.push("/login");
      return;
    }
    setAdminId(user.id);
    await loadDevedores();
  }

  async function loadDevedores() {
    setLoading(true);

    // Busca jogo mais recente
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

    // Busca quem não pagou com telefone e log de cobranças
    const { data } = await supabase
      .from("game_players")
      .select(
        `
        id,
        user_id,
        tipo,
        multa_aplicada,
        users(nome_completo, telefone),
        cobrancas_log(enviado_em)
      `,
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
        const logs = (d.cobrancas_log as any[]) ?? [];
        const ultima =
          logs.length > 0
            ? logs.sort(
                (a: any, b: any) =>
                  new Date(b.enviado_em).getTime() -
                  new Date(a.enviado_em).getTime(),
              )[0].enviado_em
            : null;

        return {
          id: d.id,
          user_id: d.user_id,
          nome: (d.users as any)?.nome_completo ?? "—",
          telefone: (d.users as any)?.telefone ?? null,
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
    const nome = devedor.nome.split(" ")[0]; // só o primeiro nome

    if (tom === "gentil") {
      return `Olá ${nome}! 😊 Passando para lembrar que seu pagamento do futebol de sábado ainda está pendente${multa}. Chave PIX: ${CHAVE_PIX} 🙏`;
    } else {
      return `${nome}, seu pagamento do futebol ainda NÃO foi confirmado${multa}. Por favor regularize o quanto antes! Chave PIX: ${CHAVE_PIX} ⚽`;
    }
  }

  function formatarTelefone(tel: string): string {
    const nums = tel.replace(/\D/g, "");
    return nums.startsWith("55") ? nums : `55${nums}`;
  }

  async function cobrar(devedor: Devedor, tom: "gentil" | "serio") {
    setEnviando(devedor.id + tom);

    const mensagem = montarMensagem(devedor, tom);
    const msgEncoded = encodeURIComponent(mensagem);

    // Registra no log
    if (adminId) {
      await supabase.rpc("registrar_cobranca", {
        p_game_player_id: devedor.id,
        p_admin_id: adminId,
        p_tipo: tom,
      });
    }

    // Abre WhatsApp
    if (devedor.telefone) {
      const tel = formatarTelefone(devedor.telefone);
      window.open(`https://wa.me/${tel}?text=${msgEncoded}`, "_blank");
    } else {
      // Sem telefone — abre WhatsApp sem número para digitar manualmente
      window.open(`https://wa.me/?text=${msgEncoded}`, "_blank");
    }

    await loadDevedores();
    setEnviando(null);
  }

  return (
    <div className="min-h-screen bg-green-950 text-white px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-green-400 text-sm mb-3 flex items-center gap-1 hover:text-green-300"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold">Cobranças</h1>
          <p className="text-green-400 text-sm mt-1">
            {devedores.length} jogador{devedores.length !== 1 ? "es" : ""} com
            pagamento pendente
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : devedores.length === 0 ? (
          <div className="bg-green-900/30 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-green-300 font-semibold">Todos pagaram!</p>
            <p className="text-green-500 text-sm mt-1">
              Nenhum pagamento pendente
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {devedores.map((d) => (
              <div
                key={d.id}
                className="bg-green-900/40 border border-green-800/40 rounded-2xl overflow-hidden"
              >
                {/* Info do jogador */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{d.nome}</p>
                      <p className="text-green-500 text-xs mt-0.5">
                        {formatTipo(d.tipo)}
                      </p>
                      {d.telefone ? (
                        <p className="text-green-600 text-xs mt-0.5">
                          📱 {d.telefone}
                        </p>
                      ) : (
                        <p className="text-yellow-600 text-xs mt-0.5">
                          ⚠️ Sem telefone cadastrado
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {d.multa_aplicada && (
                        <span className="bg-red-900/60 text-red-300 text-xs px-2 py-0.5 rounded-full">
                          +20% multa
                        </span>
                      )}
                      {d.ultima_cobranca && (
                        <p className="text-green-600 text-xs mt-1">
                          Cobrado {formatRelativo(d.ultima_cobranca)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botões */}
                <div className="border-t border-green-800/40 grid grid-cols-2">
                  <button
                    onClick={() => cobrar(d, "gentil")}
                    disabled={!!enviando}
                    className="py-3 flex items-center justify-center gap-1.5 text-green-400 hover:bg-green-800/30 text-sm font-medium transition-colors disabled:opacity-50 border-r border-green-800/40"
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
                    className="py-3 flex items-center justify-center gap-1.5 text-orange-400 hover:bg-orange-900/20 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {enviando === d.id + "serio" ? <Spinner /> : <>😤 Sério</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Aviso jogadores sem telefone */}
        {devedores.some((d) => !d.telefone) && (
          <div className="mt-6 bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4 text-sm text-yellow-400">
            💡 Jogadores sem telefone vão abrir o WhatsApp sem número — você
            digita manualmente. Cadastre o telefone no perfil de cada jogador.
          </div>
        )}
      </div>
    </div>
  );
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
