"use client";
// @ts-nocheck

import React, { useState, useEffect, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { CONTRACT_CONFIG, IDL } from "@/constants/contracts";
import { Tooltip } from "@/components/Tooltip";
import {
  Award,
  Flame,
  Gift,
  LayoutDashboard,
  ShieldCheck,
  Trophy,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  ExternalLink,
} from "lucide-react";

export default function CampusPointsApp() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // Modo: Aluno vs Admin / Emissor
  const [viewMode, setViewMode] = useState<"student" | "admin">("student");
  // Aba ativa no mobile
  const [activeTab, setActiveTab] = useState<"dashboard" | "missions" | "ranking" | "rewards" | "issuer">("dashboard");

  // Estados On-Chain
  const [balance, setBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Formulario Emissor
  const [recipientInput, setRecipientInput] = useState<string>("");
  const [pointsAmountInput, setPointsAmountInput] = useState<string>("50");

  const programId = useMemo(() => new PublicKey(CONTRACT_CONFIG.programId), []);
  const mintPublicKey = useMemo(() => new PublicKey(CONTRACT_CONFIG.mint), []);

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(IDL as any, provider);
  }, [provider]);

  // Busca de saldo Token-2022
  const fetchBalance = async () => {
    if (!wallet.publicKey) {
      setBalance(0);
      return;
    }
    try {
      setIsLoadingBalance(true);
      const studentAta = getAssociatedTokenAddressSync(
        mintPublicKey,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const accountInfo = await getAccount(
        connection,
        studentAta,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      setBalance(Number(accountInfo.amount));
    } catch (err) {
      // Se a conta de token ainda nao existe, saldo e zero
      setBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [wallet.publicKey, connection]);

  // Acao: Emitir Pontos (Painel Admin)
  const handleIssuePoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program || !wallet.publicKey) {
      setStatusMessage({ type: "error", text: "Conecte a carteira de emissor autorizada." });
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage({ type: "info", text: "Enviando transação de emissão para a Solana Devnet..." });

      const recipientPubkey = new PublicKey(recipientInput.trim());
      const amountBn = new BN(Number(pointsAmountInput));

      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
      const [issuerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("issuer"), wallet.publicKey.toBuffer()],
        programId
      );

      const recipientAta = getAssociatedTokenAddressSync(
        mintPublicKey,
        recipientPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .issuePoints(amountBn)
        .accounts({
          issuer: wallet.publicKey,
          issuerAccount: issuerPda,
          campusConfig: configPda,
          mint: mintPublicKey,
          recipient: recipientPubkey,
          recipientTokenAccount: recipientAta,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      setStatusMessage({
        type: "success",
        text: `Sucesso! ${pointsAmountInput} pontos emitidos para ${recipientPubkey.toBase58().slice(0, 6)}... TX: ${tx.slice(0, 10)}...`,
      });

      if (recipientPubkey.equals(wallet.publicKey)) {
        await fetchBalance();
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Erro na emissão: ${err.message || "Verifique se você é o emissor autorizado e se possui cota diária."}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Acao: Resgatar Recompensa (Queima On-Chain)
  const handleRedeemReward = async (rewardId: number, cost: number, rewardName: string) => {
    if (!program || !wallet.publicKey) {
      setStatusMessage({ type: "error", text: "Conecte sua carteira para resgatar este benefício." });
      return;
    }

    if (balance < cost) {
      setStatusMessage({
        type: "error",
        text: `Saldo insuficiente! Você precisa de ${cost} pts, mas possui ${balance} pts.`,
      });
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage({
        type: "info",
        text: `Queimando ${cost} pontos on-chain para liberar: "${rewardName}"...`,
      });

      const rewardIdBn = new BN(rewardId);
      const [rewardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reward"), rewardIdBn.toArrayLike(Buffer, "le", 8)],
        programId
      );
      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);

      const studentAta = getAssociatedTokenAddressSync(
        mintPublicKey,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .redeemReward(rewardIdBn)
        .accounts({
          student: wallet.publicKey,
          reward: rewardPda,
          campusConfig: configPda,
          mint: mintPublicKey,
          studentTokenAccount: studentAta,
          token2022Program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      setStatusMessage({
        type: "success",
        text: `Benefício resgatado! ${cost} pontos foram destruídos de forma definitiva. TX: ${tx.slice(0, 10)}...`,
      });

      await fetchBalance();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Falha ao resgatar: ${err.message || "Erro durante a queima de tokens."}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Mock de Missões Acadêmicas
  const missionsList = [
    {
      id: "m1",
      category: "Acadêmico",
      title: "Presença em Seminário de Inovação",
      points: 50,
      desc: "Participe da palestra magna sobre infraestrutura Web3 e registre a presença via chamada digital com o coordenador.",
      validity: "Até 28/09",
    },
    {
      id: "m2",
      category: "Atlética & Esporte",
      title: "Treino Oficial da Atlética Universitária",
      points: 40,
      desc: "Compareça a um dos treinos preparatórios para os Jogos Universitários. Validação feita pelo capitão da equipe.",
      validity: "Semanal",
    },
    {
      id: "m3",
      category: "Social & Extensão",
      title: "Doação de Sangue no Hemocentro do Campus",
      points: 150,
      desc: "Apresente o comprovante de doação de sangue no Diretório Acadêmico para validação imediata da cota máxima.",
      validity: "Contínuo",
    },
    {
      id: "m4",
      category: "Biblioteca & Cultura",
      title: "Devolução Pontual de Livros do Semestre",
      points: 20,
      desc: "Mantenha o histórico sem atrasos durante todo o mês corrente junto ao sistema integrado da biblioteca.",
      validity: "Mensal",
    },
  ];

  // Mock de Ranking (Leaderboard)
  const rankingList = [
    { rank: 1, name: "Beatriz M. (Engenharia de Software)", points: 420, badge: "Ouro" },
    { rank: 2, name: "Lucas R. (Ciência da Computação)", points: 380, badge: "Prata" },
    { rank: 3, name: "Camila S. (Medicina Veterinária)", points: 310, badge: "Bronze" },
    { rank: 4, name: "Você (Carteira Conectada)", points: balance, badge: "Estudante" },
    { rank: 5, name: "Gabriel A. (Direito)", points: 190, badge: "Estudante" },
  ];

  return (
    <div className="min-h-screen bg-[#f9f1f5] text-black pb-28 sm:pb-12">
      {/* Barra de Topo */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-gray-200 px-4 py-3 sm:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-[#381af8]">
                CAMPUS POINTS
              </span>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-[#fc67f4]/20 border border-[#fc67f4] text-black">
                Devnet
              </span>
            </div>
            <p className="text-xs font-bold text-gray-700 hidden sm:block">
              Sistema Estudantil de Recompensas Intransferíveis na Solana
            </p>
          </div>

          <div className="flex items-center gap-2">
            <WalletMultiButton />
          </div>
        </div>

        {/* Alternador de Perfil para a Banca (Aluno vs Emissor) */}
        <div className="max-w-5xl mx-auto mt-2 pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <span className="text-xs font-black uppercase tracking-wider text-black mr-2">
              Modo de Demonstração:
            </span>
            <Tooltip
              title="Alternador de Perfil"
              content="Permite que os jurados testem as duas pontas da plataforma: a visão do Aluno (saldo, catálogo e queima) e a visão da Universidade (emissão de pontos com cota diária)."
            />
          </div>

          <div className="inline-flex p-1 bg-gray-200 rounded-xl border border-gray-300">
            <button
              onClick={() => {
                setViewMode("student");
                setActiveTab("dashboard");
              }}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                viewMode === "student"
                  ? "bg-[#381af8] text-white shadow"
                  : "text-black hover:bg-white/60"
              }`}
            >
              🎓 Visão do Aluno
            </button>
            <button
              onClick={() => {
                setViewMode("admin");
                setActiveTab("issuer");
              }}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                viewMode === "admin"
                  ? "bg-[#381af8] text-white shadow"
                  : "text-black hover:bg-white/60"
              }`}
            >
              🏛️ Painel do Emissor / Admin
            </button>
          </div>
        </div>
      </header>

      {/* Mensagem de Status Flutuante */}
      {statusMessage && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div
            className={`p-3 rounded-xl border-2 flex items-start justify-between gap-2 ${
              statusMessage.type === "success"
                ? "bg-green-100 border-green-600 text-black"
                : statusMessage.type === "error"
                ? "bg-red-100 border-red-600 text-black"
                : "bg-blue-100 border-[#381af8] text-black"
            }`}
          >
            <div className="text-xs font-bold leading-relaxed">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs font-black p-1 hover:bg-black/10 rounded"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-5xl mx-auto px-4 mt-6">
        {/* Navegação Desktop / Tabs Principais */}
        <div className="hidden sm:flex items-center gap-2 mb-6 border-b border-gray-300 pb-3">
          {viewMode === "student" ? (
            <>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                  activeTab === "dashboard"
                    ? "bg-[#381af8] text-white shadow-md"
                    : "bg-white text-black border border-gray-300 hover:border-[#fc67f4]"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Meu Saldo e Perfil
              </button>
              <button
                onClick={() => setActiveTab("missions")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                  activeTab === "missions"
                    ? "bg-[#381af8] text-white shadow-md"
                    : "bg-white text-black border border-gray-300 hover:border-[#fc67f4]"
                }`}
              >
                <Award className="w-4 h-4" />
                Mural de Missões
              </button>
              <button
                onClick={() => setActiveTab("rewards")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                  activeTab === "rewards"
                    ? "bg-[#381af8] text-white shadow-md"
                    : "bg-white text-black border border-gray-300 hover:border-[#fc67f4]"
                }`}
              >
                <Gift className="w-4 h-4" />
                Loja de Recompensas
              </button>
              <button
                onClick={() => setActiveTab("ranking")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                  activeTab === "ranking"
                    ? "bg-[#381af8] text-white shadow-md"
                    : "bg-white text-black border border-gray-300 hover:border-[#fc67f4]"
                }`}
              >
                <Trophy className="w-4 h-4" />
                Ranking do Campus
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab("issuer")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black bg-[#381af8] text-white shadow-md"
            >
              <ShieldCheck className="w-4 h-4" />
              Terminal de Emissão de Pontos
            </button>
          )}
        </div>

        {/* ======================================================== */}
        {/* ABA 1: DASHBOARD DO ALUNO */}
        {/* ======================================================== */}
        {activeTab === "dashboard" && viewMode === "student" && (
          <div className="space-y-6">
            {/* Card de Saldo */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-gray-300 shadow-sm relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#fc67f4]/15 rounded-full blur-xl pointer-events-none" />

              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-600">
                      Saldo Disponível do Estudante
                    </span>
                    <Tooltip
                      title="Saldo Intransferível"
                      content="Estes pontos foram emitidos na sua conta via Token-2022 com a extensão Non-Transferable. Eles não podem ser vendidos ou passados para terceiros, servindo como reputação legítima."
                    />
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl sm:text-6xl font-black text-black">
                      {isLoadingBalance ? "..." : balance}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#381af8]">
                      PONTOS
                    </span>
                  </div>
                </div>

                <button
                  onClick={fetchBalance}
                  disabled={isLoadingBalance}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-300 rounded-xl text-xs font-bold text-black hover:bg-gray-200 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-black ${isLoadingBalance ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
              </div>

              {/* Badges de Garantia Técnica */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-gray-200">
                <div className="p-3 bg-[#f9f1f5] rounded-2xl border border-gray-300">
                  <div className="flex items-center gap-1.5 text-xs font-black text-black">
                    <ShieldCheck className="w-4 h-4 text-[#381af8]" />
                    Proteção Soulbound
                  </div>
                  <p className="text-[11px] font-bold text-gray-700 mt-0.5">
                    Bloqueio nativo contra venda ou repasse de pontos.
                  </p>
                </div>

                <div className="p-3 bg-[#f9f1f5] rounded-2xl border border-gray-300">
                  <div className="flex items-center gap-1.5 text-xs font-black text-black">
                    <Flame className="w-4 h-4 text-[#fc67f4]" />
                    Queima Automática
                  </div>
                  <p className="text-[11px] font-bold text-gray-700 mt-0.5">
                    Pontos são destruídos na troca de prêmios reais.
                  </p>
                </div>

                <div className="p-3 bg-[#f9f1f5] rounded-2xl border border-gray-300">
                  <div className="flex items-center gap-1.5 text-xs font-black text-black">
                    <CheckCircle2 className="w-4 h-4 text-green-700" />
                    Custo Zero Aluno
                  </div>
                  <p className="text-[11px] font-bold text-gray-700 mt-0.5">
                    Taxas de rede subsidiadas pela universidade.
                  </p>
                </div>
              </div>

              {/* Botao de Acao Rapida */}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab("rewards")}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#381af8] text-white font-black text-sm shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4 text-white" />
                  Ir para Loja de Recompensas
                </button>
                <button
                  onClick={() => setActiveTab("missions")}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white text-black border-2 border-gray-400 font-black text-sm hover:border-[#fc67f4] transition-all flex items-center justify-center gap-2"
                >
                  <Award className="w-4 h-4 text-black" />
                  Ver Missões do Mês
                </button>
              </div>
            </div>

            {/* Identificação de Contas On-Chain */}
            <div className="bg-white rounded-2xl p-5 border-2 border-gray-300">
              <div className="flex items-center mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-black">
                  Registro Criptográfico do Contrato
                </span>
                <Tooltip
                  title="Auditoria Pública"
                  content="Endereços imutáveis implantados na Solana Devnet para verificação da banca avaliadora."
                />
              </div>
              <div className="space-y-2 text-xs font-bold text-gray-800 break-all">
                <div className="p-2 bg-[#f9f1f5] rounded-lg">
                  <span className="text-black font-black">Program ID: </span>
                  {CONTRACT_CONFIG.programId}
                </div>
                <div className="p-2 bg-[#f9f1f5] rounded-lg">
                  <span className="text-black font-black">Mint Token-2022: </span>
                  {CONTRACT_CONFIG.mint}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 2: MURAL DE MISSÕES */}
        {/* ======================================================== */}
        {activeTab === "missions" && viewMode === "student" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-black">Mural de Missões do Mês</h2>
                <p className="text-xs font-bold text-gray-700">
                  Participe das ações presenciais e ganhe pontos validados pela coordenação.
                </p>
              </div>
              <Tooltip
                title="Como Funciona a Validação?"
                content="Cada atividade possui um responsável oficial (professor, capitão da atlética ou diretório). Ao comparecer, o responsável lança seus pontos direto na sua carteira pelo Painel de Emissor."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {missionsList.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl p-5 border-2 border-gray-300 hover:border-[#fc67f4] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-gray-100 border border-gray-300 text-black">
                        {m.category}
                      </span>
                      <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-[#fc67f4]/20 border border-[#fc67f4] text-black">
                        +{m.points} PTS
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-black mb-1">{m.title}</h3>
                    <p className="text-xs font-bold text-gray-700 leading-relaxed">{m.desc}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-600">
                      Prazo: <span className="text-black font-black">{m.validity}</span>
                    </span>
                    <span className="text-xs font-black text-[#381af8]">
                      Validação Presencial
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 3: LOJA DE RECOMPENSAS (RESGATE COM BURN ON-CHAIN) */}
        {/* ======================================================== */}
        {activeTab === "rewards" && viewMode === "student" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-black">Catálogo de Resgate</h2>
                <p className="text-xs font-bold text-gray-700">
                  Troque seus pontos por vantagens reais. Os pontos são queimados on-chain.
                </p>
              </div>
              <Tooltip
                title="Mecanismo de Queima (Burn)"
                content="Ao clicar em resgatar, o contrato chama o CPI de queima do Token-2022. Os pontos são destruídos da sua carteira e o benefício é liberado."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {CONTRACT_CONFIG.rewards.map((reward) => {
                const canAfford = balance >= reward.cost;
                return (
                  <div
                    key={reward.id}
                    className={`bg-white rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                      canAfford ? "border-gray-300 hover:border-[#fc67f4]" : "border-gray-200 opacity-80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-black">
                          Item #{reward.id}
                        </span>
                        <span className="text-sm font-black text-[#381af8]">
                          {reward.cost} PTS
                        </span>
                      </div>

                      <h3 className="text-base font-black text-black mb-2">
                        {reward.name}
                      </h3>

                      <p className="text-xs font-bold text-gray-700 leading-relaxed mb-4">
                        Benefício válido para apresentação imediata no estabelecimento parceiro.
                      </p>
                    </div>

                    <div>
                      <button
                        onClick={() => handleRedeemReward(reward.id, reward.cost, reward.name)}
                        disabled={isProcessing || !wallet.publicKey || !canAfford}
                        className={`w-full py-3 px-4 rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 ${
                          canAfford && wallet.publicKey
                            ? "bg-[#381af8] text-white active:scale-95 hover:opacity-95"
                            : "bg-gray-300 text-gray-700 cursor-not-allowed"
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        {canAfford ? "Resgatar (Queimar Pontos)" : "Saldo Insuficiente"}
                      </button>

                      {!canAfford && (
                        <p className="text-[10px] font-black text-red-600 text-center mt-2">
                          Faltam {reward.cost - balance} pontos para desbloquear.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 4: RANKING (LEADERBOARD) */}
        {/* ======================================================== */}
        {activeTab === "ranking" && viewMode === "student" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-black">Quadro de Líderes do Campus</h2>
                <p className="text-xs font-bold text-gray-700">
                  Classificação pública dos estudantes mais ativos no semestre.
                </p>
              </div>
              <Tooltip
                title="Critério de Posição"
                content="O ranking avalia a pontuação acumulada por mérito do estudante. Como os pontos são intransferíveis, o ranking reflete dedicação acadêmica real."
              />
            </div>

            <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-200">
                {rankingList.map((student) => (
                  <div
                    key={student.rank}
                    className={`p-4 flex items-center justify-between gap-3 ${
                      student.rank === 4 ? "bg-[#fc67f4]/15 border-l-4 border-l-[#fc67f4]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                          student.rank === 1
                            ? "bg-yellow-400 text-black border-2 border-yellow-600"
                            : student.rank === 2
                            ? "bg-gray-300 text-black border-2 border-gray-500"
                            : student.rank === 3
                            ? "bg-amber-600 text-white"
                            : "bg-gray-100 text-black border border-gray-300"
                        }`}
                      >
                        {student.rank}
                      </div>
                      <div>
                        <div className="text-xs font-black text-black">{student.name}</div>
                        <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                          Distintivo: {student.badge}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-[#381af8]">
                        {student.points} PTS
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 5: PAINEL DO EMISSOR / ADMIN (EMISSÃO ON-CHAIN) */}
        {/* ======================================================== */}
        {(activeTab === "issuer" || viewMode === "admin") && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-gray-300 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-black">
                    Terminal Institucional de Emissão
                  </h2>
                  <p className="text-xs font-bold text-gray-700">
                    Apenas carteiras de professores ou autoridades cadastradas podem emitir pontos.
                  </p>
                </div>
                <Tooltip
                  title="Cota Diária de Emissão"
                  content="Cada emissor possui um teto máximo de emissão por dia (configurado em 1.000 pontos para este contrato). Isso impede a inflação desordenada de pontos."
                />
              </div>

              {/* Status do Emissor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-[#f9f1f5] rounded-xl border border-gray-300">
                  <span className="text-[11px] font-black uppercase text-gray-600">
                    Emissor Autorizado Cadastrado:
                  </span>
                  <p className="text-xs font-black text-black break-all mt-0.5">
                    {CONTRACT_CONFIG.issuerAuthority}
                  </p>
                </div>
                <div className="p-3 bg-[#f9f1f5] rounded-xl border border-gray-300">
                  <span className="text-[11px] font-black uppercase text-gray-600">
                    Cota Diária Máxima do Protocolo:
                  </span>
                  <p className="text-xs font-black text-[#381af8] mt-0.5">
                    1.000 Pontos / Dia
                  </p>
                </div>
              </div>

              {/* Formulário de Emissão */}
              <form onSubmit={handleIssuePoints} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    Endereço da Carteira do Aluno (Solana):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      placeholder="Ex: 7aSDp11gPbCCew7yMSQKuBLr6pcKfgwRPtp2QgAE89f3"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 text-xs font-bold text-black focus:outline-none focus:border-[#381af8]"
                    />
                    {wallet.publicKey && (
                      <button
                        type="button"
                        onClick={() => setRecipientInput(wallet.publicKey?.toBase58() || "")}
                        className="px-3 py-2 bg-gray-100 border border-gray-300 text-[10px] font-black text-black rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap"
                      >
                        Usar Minha
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    Quantidade de Pontos a Emitir:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={pointsAmountInput}
                    onChange={(e) => setPointsAmountInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 text-xs font-bold text-black focus:outline-none focus:border-[#381af8]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isProcessing || !wallet.publicKey}
                  className="w-full py-4 rounded-xl bg-[#381af8] text-white font-black text-sm shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 text-white" />
                  {isProcessing ? "Emitindo na Devnet..." : "Confirmar Emissão On-Chain"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* BARRA DE NAVEGAÇÃO INFERIOR PARA CELULAR (MOBILE-FIRST) */}
      {/* ======================================================== */}
      {viewMode === "student" && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t-2 border-gray-300 px-2 py-2 sm:hidden flex items-center justify-around">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center py-1 px-2 rounded-lg ${
              activeTab === "dashboard" ? "text-[#381af8]" : "text-gray-800"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" strokeWidth={activeTab === "dashboard" ? 3 : 2} />
            <span className="text-[10px] font-black mt-0.5">Saldo</span>
          </button>

          <button
            onClick={() => setActiveTab("missions")}
            className={`flex flex-col items-center py-1 px-2 rounded-lg ${
              activeTab === "missions" ? "text-[#381af8]" : "text-gray-800"
            }`}
          >
            <Award className="w-5 h-5" strokeWidth={activeTab === "missions" ? 3 : 2} />
            <span className="text-[10px] font-black mt-0.5">Missões</span>
          </button>

          <button
            onClick={() => setActiveTab("rewards")}
            className={`flex flex-col items-center py-1 px-2 rounded-lg ${
              activeTab === "rewards" ? "text-[#381af8]" : "text-gray-800"
            }`}
          >
            <Gift className="w-5 h-5" strokeWidth={activeTab === "rewards" ? 3 : 2} />
            <span className="text-[10px] font-black mt-0.5">Loja</span>
          </button>

          <button
            onClick={() => setActiveTab("ranking")}
            className={`flex flex-col items-center py-1 px-2 rounded-lg ${
              activeTab === "ranking" ? "text-[#381af8]" : "text-gray-800"
            }`}
          >
            <Trophy className="w-5 h-5" strokeWidth={activeTab === "ranking" ? 3 : 2} />
            <span className="text-[10px] font-black mt-0.5">Ranking</span>
          </button>
        </nav>
      )}
    </div>
  );
}
