"use client";
// @ts-nocheck

import React, { useState, useEffect, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { CONTRACT_CONFIG, IDL } from "@/constants/contracts";
import { Tooltip } from "@/components/Tooltip";
import { WalletButton } from "@/components/WalletButton";
import {
  Award,
  Flame,
  Gift,
  LayoutDashboard,
  ShieldCheck,
  Trophy,
  CheckCircle2,
  RefreshCw,
  Send,
  Check,
  UserPlus,
  Users,
} from "lucide-react";

interface Mission {
  id: string;
  category: string;
  title: string;
  points: number;
  desc: string;
  requirement: string;
  validity: string;
}

interface PendingSubmission {
  id: string;
  missionTitle: string;
  studentAddress: string;
  points: number;
  proofNote: string;
  timestamp: string;
}

interface LeaderboardEntry {
  address: string;
  balance: number;
}

const MISSIONS: Mission[] = [
  {
    id: "m1",
    category: "Academico",
    title: "Monitoria Voluntaria de Algoritmos",
    points: 120,
    desc: "Apoio presencial a alunos do primeiro semestre nos laboratorios de programacao.",
    requirement: "Assinatura do professor responsavel no relatorio quinzenal.",
    validity: "Semestral",
  },
  {
    id: "m2",
    category: "Inovacao",
    title: "Participacao em Hackathon Universitario",
    points: 200,
    desc: "Desenvolvimento e apresentacao de projeto MVP em maratona tecnologica do campus.",
    requirement: "Link do repositorio e comprovante de submissao da equipe.",
    validity: "Por edicao",
  },
  {
    id: "m3",
    category: "Social",
    title: "Doacao de Sangue no Hemocentro",
    points: 150,
    desc: "Campanha institucional de doacao com comprovante emitido pela unidade de saude.",
    requirement: "Declaracao oficial de comparecimento do hemocentro.",
    validity: "Bimestral",
  },
  {
    id: "m4",
    category: "Atletica",
    title: "Atleta Titular nos Jogos Universitarios",
    points: 100,
    desc: "Representacao oficial da universidade em modalidade esportiva reconhecida pela LAU.",
    requirement: "Sumula da partida validada pela comissao tecnica.",
    validity: "Por torneio",
  },
  {
    id: "m5",
    category: "Pesquisa",
    title: "Publicacao de Artigo em Congresso",
    points: 250,
    desc: "Artigo completo ou resumo expandido aceito em evento cientifico indexado.",
    requirement: "Certificado de aceite com DOI ou link nos anais.",
    validity: "Anual",
  },
  {
    id: "m6",
    category: "Extensao",
    title: "Oficina Tecnologica para a Comunidade",
    points: 80,
    desc: "Ministracao de minicurso basico de informatica ou robotica para jovens locais.",
    requirement: "Lista de presenca homologada pela Coordenadoria de Extensao.",
    validity: "Por oficina",
  },
  {
    id: "m7",
    category: "Sustentabilidade",
    title: "Mutirao de Reciclagem Eletronica",
    points: 60,
    desc: "Descarte correto e triagem de lixo tecnologico no ponto de coleta do DCE.",
    requirement: "Comprovante de pesagem assinado pelo comite ambiental.",
    validity: "Mensal",
  },
  {
    id: "m8",
    category: "Cultura",
    title: "Organizacao da Semana Academica",
    points: 90,
    desc: "Staff operacional no credenciamento, audio e organizacao de palestras.",
    requirement: "Relatorio de horas validado pela diretoria do curso.",
    validity: "Por semana",
  },
];

const REWARDS = [
  { id: 1, name: "Cafe Especial no DCE", cost: 30, desc: "Vale 1 expresso ou cappuccino na cafeteria estudantil." },
  { id: 2, name: "Credito R$ 15 em Xerox", cost: 75, desc: "Impressao de apostilas e trabalhos academicos na copiadora central." },
  { id: 3, name: "Camiseta Oficial Atletica", cost: 150, desc: "Modelo exclusivo de algodao comemorativo da temporada." },
  { id: 4, name: "Almoco no Restaurante Universitario", cost: 50, desc: "Ticket refeicao completa com prato principal, sobremesa e suco." },
  { id: 5, name: "Credencial de Estacionamento (1 Semana)", cost: 120, desc: "Acesso livre ao patio coberto do campus principal." },
  { id: 6, name: "Isencao em Certificado de Curso Extensao", cost: 200, desc: "Gratuidade na emissao de diploma de cursos extracurriculares." },
];

export default function CampusPointsApp() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [viewMode, setViewMode] = useState<"student" | "admin">("student");
  const [activeTab, setActiveTab] = useState<"dashboard" | "missions" | "ranking" | "rewards" | "issuer">("dashboard");

  const [balance, setBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Status de Coordenador da Carteira Conectada
  const [isAuthorizedIssuer, setIsAuthorizedIssuer] = useState<boolean>(false);
  const [issuerDailyLimit, setIssuerDailyLimit] = useState<number>(1000);
  const [registeredIssuersList, setRegisteredIssuersList] = useState<string[]>([CONTRACT_CONFIG.issuerAuthority]);

  // Formulario de cadastro de nova coordenadora
  const [newCoordinatorInput, setNewCoordinatorInput] = useState<string>("");
  const [newQuotaInput, setNewQuotaInput] = useState<string>("1000");

  // Fila de submissoes
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState<boolean>(false);

  // Ranking real on-chain
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  const programId = useMemo(() => new PublicKey(CONTRACT_CONFIG.programId), []);
  const mintPublicKey = useMemo(() => new PublicKey(CONTRACT_CONFIG.mint), []);

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  }, [connection, wallet]);

  const program = useMemo<any>(() => {
    if (!provider) return null;
    return new (Program as any)(IDL, provider);
  }, [provider]);

  // Checar se a carteira conectada e coordenadora ativa no contrato
  const checkIssuerStatus = async (currentList?: string[]) => {
    const listToCheck = currentList || registeredIssuersList;
    if (wallet.publicKey && listToCheck.includes(wallet.publicKey.toBase58())) {
      setIsAuthorizedIssuer(true);
      return;
    }
    if (!wallet.publicKey) {
      setIsAuthorizedIssuer(false);
      return;
    }

    try {
      const [issuerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("issuer"), wallet.publicKey.toBuffer()],
        programId
      );

      const info = await connection.getAccountInfo(issuerPda);
      if (info && info.data.length > 0) {
        setIsAuthorizedIssuer(true);
      } else if (wallet.publicKey.toBase58() === CONTRACT_CONFIG.issuerAuthority) {
        setIsAuthorizedIssuer(true);
      } else {
        setIsAuthorizedIssuer(false);
      }
    } catch {
      setIsAuthorizedIssuer(false);
    }
  };

  // Carregar lista de coordenadoras cadastradas
  const fetchRegisteredIssuers = async () => {
    try {
      const res = await fetch("/api/issuer");
      const data = await res.json();
      if (data.issuers && Array.isArray(data.issuers)) {
        setRegisteredIssuersList(data.issuers);
        await checkIssuerStatus(data.issuers);
      }
    } catch (err) {
      console.error("Erro ao puxar coordenadoras:", err);
    }
  };

  // Sincronizar Fila de Submissoes via API
  const fetchSubmissions = async () => {
    try {
      setIsLoadingSubmissions(true);
      const res = await fetch("/api/submissions");
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao puxar submissoes:", err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Leitura de Saldo Estudantil
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
    } catch {
      setBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Leitura do Ranking Real On-Chain
  const fetchLeaderboard = async () => {
    try {
      setIsLoadingLeaderboard(true);
      const largest = await connection.getTokenLargestAccounts(mintPublicKey);
      const list: LeaderboardEntry[] = [];

      if (largest && largest.value) {
        for (const item of largest.value) {
          try {
            const acc = await getAccount(connection, item.address, "confirmed", TOKEN_2022_PROGRAM_ID);
            const val = Number(acc.amount);
            if (val > 0) {
              list.push({
                address: acc.owner.toBase58(),
                balance: val,
              });
            }
          } catch {
            // ignora conta em transicao
          }
        }
      }

      list.sort((a, b) => b.balance - a.balance);
      setLeaderboard(list);
    } catch (err) {
      console.error("Erro no ranking:", err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchLeaderboard();
    fetchSubmissions();
    checkIssuerStatus();
    fetchRegisteredIssuers();

    const interval = setInterval(() => {
      fetchSubmissions();
    }, 4000);

    return () => clearInterval(interval);
  }, [wallet.publicKey, connection]);

  // Aluno protocolar comprovante
  const handleStudentSubmit = async (mission: Mission) => {
    if (!wallet.publicKey) {
      setStatusMessage({ type: "error", text: "Conecte sua carteira para protocolar a missao." });
      return;
    }

    const payload: PendingSubmission = {
      id: `sub-${Date.now()}`,
      missionTitle: mission.title,
      studentAddress: wallet.publicKey.toBase58(),
      points: mission.points,
      proofNote: `Comprovante protocolado para ${mission.category}.`,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    try {
      await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setStatusMessage({
        type: "success",
        text: `Solicitacao enviada. A coordenacao pode aprovar pelo painel em qualquer dispositivo.`,
      });
      await fetchSubmissions();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: `Falha ao registrar: ${err.message}` });
    }
  };

  // Cadastrar nova carteira de Coordenadora on-chain
  const handleRegisterCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = newCoordinatorInput.trim();
    if (!target) {
      setStatusMessage({ type: "error", text: "Informe o endereco da carteira da coordenadora." });
      return;
    }

    try {
      new PublicKey(target);
    } catch {
      setStatusMessage({ type: "error", text: "Endereco de carteira Solana invalido." });
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage({ type: "info", text: `Cadastrando ${target.slice(0, 8)}... como Coordenadora Oficial no contrato...` });

      const res = await fetch("/api/issuer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_issuer",
          targetWallet: target,
          dailyLimit: Number(newQuotaInput) || 1000,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatusMessage({
        type: "success",
        text: `Coordenadora cadastrada com sucesso. Cota diaria de ${newQuotaInput} pts liberada. TX: ${data.tx.slice(0, 10)}...`,
      });

      setNewCoordinatorInput("");
      await fetchRegisteredIssuers();
      await checkIssuerStatus();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: `Erro no cadastro: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // Coordenador aprova e emite pontos on-chain
  const handleApproveAndIssue = async (sub: PendingSubmission) => {
    try {
      setIsProcessing(true);
      setStatusMessage({ type: "info", text: `Emitindo ${sub.points} pontos on-chain para ${sub.studentAddress.slice(0, 6)}...` });

      const recipientPubkey = new PublicKey(sub.studentAddress);
      const recipientAta = getAssociatedTokenAddressSync(
        mintPublicKey,
        recipientPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);

      // Se a carteira conectada estiver autorizada e tiver sol para taxa, assina direto
      if (isAuthorizedIssuer && program && wallet.publicKey) {
        const [issuerPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("issuer"), wallet.publicKey.toBuffer()],
          programId
        );

        try {
          await program.methods
            .issuePoints(new BN(sub.points))
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
        } catch (directErr: any) {
          // Fallback caso a carteira conectada esteja sem saldo Devnet SOL para gas
          console.warn("Assinatura direta falhou, acionando relayer subsidiado:", directErr);
          const res = await fetch("/api/issuer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "subsidized_issue",
              targetWallet: sub.studentAddress,
              points: sub.points,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
        }
      } else {
        // Fallback subsidiado pela autoridade principal
        const res = await fetch("/api/issuer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "subsidized_issue",
            targetWallet: sub.studentAddress,
            points: sub.points,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      await fetch(`/api/submissions?id=${sub.id}`, { method: "DELETE" });
      await fetchSubmissions();

      setStatusMessage({
        type: "success",
        text: `Missao homologada. ${sub.points} pontos emitidos on-chain para ${sub.studentAddress.slice(0, 8)}...`,
      });

      await fetchBalance();
      await fetchLeaderboard();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Erro na emissao on-chain: ${err.message || JSON.stringify(err)}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Resgate de pontos com queima on-chain
  const handleRedeemReward = async (rewardId: number, cost: number, rewardName: string) => {
    if (!program || !wallet.publicKey) {
      setStatusMessage({ type: "error", text: "Conecte sua carteira para resgatar." });
      return;
    }

    if (balance < cost) {
      setStatusMessage({
        type: "error",
        text: `Saldo insuficiente. Necessario ${cost} pts, saldo atual: ${balance} pts.`,
      });
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage({
        type: "info",
        text: `Destruindo ${cost} pontos on-chain para resgatar: ${rewardName}...`,
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
        text: `Resgate concluido. ${cost} pontos queimados on-chain. TX: ${tx.slice(0, 10)}...`,
      });

      await fetchBalance();
      await fetchLeaderboard();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Falha no resgate: ${err.message || JSON.stringify(err)}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f1f5] text-black pb-32 sm:pb-16 font-sans">
      {/* Topo */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-neutral-300 px-4 py-4 sm:px-8 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-[#381af8]">
                CAMPUS POINTS
              </span>
              <span className="px-2.5 py-0.5 text-xs font-black uppercase rounded-md bg-[#fc67f4]/20 border border-[#fc67f4] text-black">
                Devnet
              </span>
            </div>
            <p className="text-sm font-bold text-neutral-800 hidden sm:block mt-0.5">
              Protocolo Institucional de Reputacao Academica e Beneficios
            </p>
          </div>

          <WalletButton />
        </div>

        {/* Alternador de Perfil */}
        <div className="max-w-5xl mx-auto mt-3 pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <span className="text-xs font-black uppercase tracking-wider text-black mr-2">
              Perfil de Demonstracao:
            </span>
            <Tooltip
              title="Alternador de Papel"
              content="Alterne entre o perfil do Aluno (saldo, missoes, queima) e o perfil da Coordenacao (cadastro de emissores e aprovacao)."
            />
          </div>

          <div className="inline-flex p-1 bg-neutral-200 rounded-xl border border-neutral-300">
            <button
              onClick={() => {
                setViewMode("student");
                setActiveTab("dashboard");
              }}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                viewMode === "student"
                  ? "bg-[#381af8] text-white shadow"
                  : "text-black hover:bg-white/70"
              }`}
            >
              Visao do Aluno
            </button>
            <button
              onClick={() => {
                setViewMode("admin");
                setActiveTab("issuer");
              }}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                viewMode === "admin"
                  ? "bg-[#381af8] text-white shadow"
                  : "text-black hover:bg-white/70"
              }`}
            >
              Painel do Coordenador ({submissions.length})
            </button>
          </div>
        </div>
      </header>

      {/* Alertas */}
      {statusMessage && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div
            className={`p-4 rounded-xl border-2 flex items-start justify-between gap-3 ${
              statusMessage.type === "success"
                ? "bg-green-100 border-green-700 text-black"
                : statusMessage.type === "error"
                ? "bg-red-100 border-red-700 text-black"
                : "bg-blue-100 border-[#381af8] text-black"
            }`}
          >
            <div className="text-sm font-extrabold leading-relaxed">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-sm font-black p-1 hover:bg-black/10 rounded"
            >
              X
            </button>
          </div>
        </div>
      )}

      {/* Conteudo Principal */}
      <main className="max-w-5xl mx-auto px-4 mt-6">
        <div className="hidden sm:flex items-center gap-2 mb-6 border-b-2 border-neutral-300 pb-3">
          {viewMode === "student" ? (
            <>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "dashboard"
                    ? "bg-[#381af8] text-white shadow"
                    : "bg-white text-black border-2 border-neutral-300 hover:border-black"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Meu Saldo e Registro
              </button>
              <button
                onClick={() => setActiveTab("missions")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "missions"
                    ? "bg-[#381af8] text-white shadow"
                    : "bg-white text-black border-2 border-neutral-300 hover:border-black"
                }`}
              >
                <Award className="w-4 h-4" />
                Missoes Disponiveis ({MISSIONS.length})
              </button>
              <button
                onClick={() => setActiveTab("rewards")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "rewards"
                    ? "bg-[#381af8] text-white shadow"
                    : "bg-white text-black border-2 border-neutral-300 hover:border-black"
                }`}
              >
                <Gift className="w-4 h-4" />
                Loja de Resgate ({REWARDS.length})
              </button>
              <button
                onClick={() => setActiveTab("ranking")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "ranking"
                    ? "bg-[#381af8] text-white shadow"
                    : "bg-white text-black border-2 border-neutral-300 hover:border-black"
                }`}
              >
                <Trophy className="w-4 h-4" />
                Ranking On-Chain ({leaderboard.length})
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab("issuer")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-[#381af8] text-white shadow"
            >
              <ShieldCheck className="w-4 h-4" />
              Terminal da Coordenacao e Emissores
            </button>
          )}
        </div>

        {/* ======================================================== */}
        {/* ABA: DASHBOARD */}
        {/* ======================================================== */}
        {activeTab === "dashboard" && viewMode === "student" && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-neutral-300 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center">
                    <span className="text-sm font-black uppercase tracking-wider text-neutral-600">
                      Saldo Academico Intransferivel
                    </span>
                    <Tooltip
                      title="Garantia Soulbound"
                      content="Emitido via Token-2022 com a extensao Non-Transferable. Impossivel vender ou transferir para terceiros."
                    />
                  </div>
                  <div className="flex items-baseline gap-3 mt-2">
                    <span className="text-5xl sm:text-7xl font-black text-black">
                      {isLoadingBalance ? "..." : balance}
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-[#381af8]">
                      PONTOS
                    </span>
                  </div>
                </div>

                <button
                  onClick={fetchBalance}
                  disabled={isLoadingBalance}
                  className="flex items-center gap-2 px-4 py-3 bg-neutral-100 border-2 border-neutral-300 rounded-xl text-sm font-black text-black hover:bg-neutral-200 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-black ${isLoadingBalance ? "animate-spin" : ""}`} />
                  Atualizar Saldo
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t-2 border-neutral-200">
                <div className="p-4 bg-[#f9f1f5] rounded-2xl border-2 border-neutral-300">
                  <div className="flex items-center gap-2 text-sm font-black text-black">
                    <ShieldCheck className="w-5 h-5 text-[#381af8]" />
                    Bloqueio Soulbound
                  </div>
                  <p className="text-xs font-bold text-neutral-800 mt-1">
                    Protegido criptograficamente pela extensao Non-Transferable.
                  </p>
                </div>

                <div className="p-4 bg-[#f9f1f5] rounded-2xl border-2 border-neutral-300">
                  <div className="flex items-center gap-2 text-sm font-black text-black">
                    <Flame className="w-5 h-5 text-[#fc67f4]" />
                    Queima Definitiva
                  </div>
                  <p className="text-xs font-bold text-neutral-800 mt-1">
                    Tokens sao destruidos on-chain no ato de resgate.
                  </p>
                </div>

                <div className="p-4 bg-[#f9f1f5] rounded-2xl border-2 border-neutral-300">
                  <div className="flex items-center gap-2 text-sm font-black text-black">
                    <CheckCircle2 className="w-5 h-5 text-green-700" />
                    Cotas Controladas
                  </div>
                  <p className="text-xs font-bold text-neutral-800 mt-1">
                    Emissoes limitadas por coordenadora cadastrada.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={() => setActiveTab("missions")}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#381af8] text-white font-black text-base shadow hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Award className="w-5 h-5 text-white" />
                  Ver Mural de Missoes
                </button>
                <button
                  onClick={() => setActiveTab("rewards")}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-black border-2 border-neutral-400 font-black text-base hover:border-black transition-all flex items-center justify-center gap-2"
                >
                  <Gift className="w-5 h-5 text-black" />
                  Acessar Loja de Resgate
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-neutral-300">
              <div className="text-sm font-black uppercase tracking-wider text-black mb-3">
                Identificadores On-Chain Verificados (Devnet)
              </div>
              <div className="space-y-3 text-xs font-extrabold text-neutral-900 break-all">
                <div className="p-3 bg-[#f9f1f5] rounded-xl border border-neutral-300">
                  <span className="text-neutral-600 block text-[10px] uppercase font-black">Program ID:</span>
                  {CONTRACT_CONFIG.programId}
                </div>
                <div className="p-3 bg-[#f9f1f5] rounded-xl border border-neutral-300">
                  <span className="text-neutral-600 block text-[10px] uppercase font-black">Mint Token-2022 (Non-Transferable):</span>
                  {CONTRACT_CONFIG.mint}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA: MURAL DE MISSOES */}
        {/* ======================================================== */}
        {activeTab === "missions" && viewMode === "student" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-black">Mural de Missoes Academicas</h2>
                <p className="text-sm font-bold text-neutral-700">
                  Solicite a validacao da atividade com 1 clique para emissao dos pontos.
                </p>
              </div>
              <Tooltip
                title="Fluxo de Submissao"
                content="A submissao cai imediatamente na Fila de Aprovacao da Coordenacao para emissao on-chain."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MISSIONS.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl p-6 border-2 border-neutral-300 hover:border-black transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-3 py-1 text-xs font-black uppercase rounded-lg bg-neutral-100 border border-neutral-300 text-black">
                        {m.category}
                      </span>
                      <span className="px-3 py-1 text-sm font-black rounded-lg bg-[#fc67f4]/20 border border-[#fc67f4] text-black">
                        +{m.points} PONTOS
                      </span>
                    </div>

                    <h3 className="text-base font-black text-black mb-2">{m.title}</h3>
                    <p className="text-xs font-bold text-neutral-700 leading-relaxed mb-3">{m.desc}</p>

                    <div className="p-3 bg-[#f9f1f5] rounded-xl border border-neutral-300 text-xs font-bold text-neutral-900 mb-4">
                      <span className="font-black text-black block mb-0.5">Exigencia:</span>
                      {m.requirement}
                    </div>
                  </div>

                  <div className="pt-3 border-t-2 border-neutral-200 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-neutral-600">
                      Ciclo: <span className="text-black font-black">{m.validity}</span>
                    </span>

                    <button
                      onClick={() => handleStudentSubmit(m)}
                      className="px-4 py-2.5 rounded-xl bg-[#381af8] text-white font-black text-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Protocolar Comprovante
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA: LOJA DE RECOMPENSAS */}
        {/* ======================================================== */}
        {activeTab === "rewards" && viewMode === "student" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-black">Catalogo de Resgate</h2>
                <p className="text-sm font-bold text-neutral-700">
                  Os tokens sao queimados diretamente no contrato para liquidar o beneficio.
                </p>
              </div>
              <Tooltip
                title="Mecanica de Burn"
                content="A instrucao redeemReward queima os tokens da sua carteira e grava o evento on-chain."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {REWARDS.map((reward) => {
                const canAfford = balance >= reward.cost;
                return (
                  <div
                    key={reward.id}
                    className={`bg-white rounded-2xl p-6 border-2 transition-all flex flex-col justify-between ${
                      canAfford ? "border-neutral-300 hover:border-black" : "border-neutral-200 opacity-80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black uppercase px-2.5 py-1 rounded bg-neutral-100 border border-neutral-300 text-black">
                          Item #{reward.id}
                        </span>
                        <span className="text-base font-black text-[#381af8]">
                          {reward.cost} PTS
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-black mb-2">{reward.name}</h3>
                      <p className="text-xs font-bold text-neutral-700 leading-relaxed mb-6">{reward.desc}</p>
                    </div>

                    <div>
                      <button
                        onClick={() => handleRedeemReward(reward.id, reward.cost, reward.name)}
                        disabled={isProcessing || !wallet.publicKey || !canAfford}
                        className={`w-full py-3.5 px-4 rounded-xl font-black text-xs shadow transition-all flex items-center justify-center gap-2 ${
                          canAfford && wallet.publicKey
                            ? "bg-[#381af8] text-white active:scale-95 hover:opacity-95"
                            : "bg-neutral-300 text-neutral-700 cursor-not-allowed"
                        }`}
                      >
                        <Flame className="w-4 h-4 text-white" />
                        {canAfford ? "Resgatar (Queimar Pontos)" : "Saldo Insuficiente"}
                      </button>

                      {!canAfford && (
                        <p className="text-[11px] font-black text-red-600 text-center mt-2">
                          Necessario mais {reward.cost - balance} pts.
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
        {/* ABA: RANKING ON-CHAIN REAL */}
        {/* ======================================================== */}
        {activeTab === "ranking" && viewMode === "student" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-black">Ranking On-Chain do Campus</h2>
                <p className="text-sm font-bold text-neutral-700">
                  Lido em tempo real das contas da Mint Token-2022 na Devnet.
                </p>
              </div>

              <button
                onClick={fetchLeaderboard}
                disabled={isLoadingLeaderboard}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-neutral-300 rounded-xl text-xs font-black text-black hover:bg-neutral-100"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLeaderboard ? "animate-spin" : ""}`} />
                Recarregar
              </button>
            </div>

            <div className="bg-white rounded-2xl border-2 border-neutral-300 overflow-hidden shadow-sm">
              {isLoadingLeaderboard ? (
                <div className="p-8 text-center text-sm font-black text-neutral-700">
                  Consultando estado de contas na Solana Devnet...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="p-8 text-center text-sm font-black text-neutral-700">
                  Nenhuma conta encontrada com saldo positivo nesta Mint.
                </div>
              ) : (
                <div className="divide-y-2 divide-neutral-200">
                  {leaderboard.map((entry, index) => {
                    const isCurrentUser =
                      wallet.publicKey && entry.address === wallet.publicKey.toBase58();
                    return (
                      <div
                        key={entry.address}
                        className={`p-4 sm:p-5 flex items-center justify-between gap-4 ${
                          isCurrentUser ? "bg-[#fc67f4]/15 border-l-4 border-l-[#fc67f4]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                              index === 0
                                ? "bg-yellow-400 text-black border-2 border-yellow-600"
                                : index === 1
                                ? "bg-neutral-300 text-black border-2 border-neutral-500"
                                : index === 2
                                ? "bg-amber-600 text-white"
                                : "bg-neutral-100 text-black border border-neutral-300"
                            }`}
                          >
                            #{index + 1}
                          </div>
                          <div>
                            <div className="text-sm font-black text-black flex items-center gap-2">
                              <span>
                                {entry.address.slice(0, 8)}...{entry.address.slice(-6)}
                              </span>
                              {isCurrentUser && (
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-[#381af8] text-white">
                                  Sua Carteira
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-neutral-600">
                              Titular verificado via Token-2022
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-black text-[#381af8]">
                            {entry.balance} PTS
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA: PAINEL DO COORDENADOR / ADMIN */}
        {/* ======================================================== */}
        {(activeTab === "issuer" || viewMode === "admin") && (
          <div className="space-y-6">
            {/* Status da Carteira Conectada */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-neutral-300 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b-2 border-neutral-200">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-neutral-600">
                    Status da Carteira Conectada
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base sm:text-lg font-black text-black font-mono">
                      {wallet.publicKey ? `${wallet.publicKey.toBase58().slice(0, 10)}...${wallet.publicKey.toBase58().slice(-8)}` : "Desconectada"}
                    </span>
                    {isAuthorizedIssuer ? (
                      <span className="px-2.5 py-1 text-xs font-black uppercase rounded-lg bg-green-100 border border-green-600 text-green-800">
                        Coordenadora Autorizada
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-black uppercase rounded-lg bg-neutral-200 border border-neutral-400 text-neutral-800">
                        Apenas Aluno / Nao Autorizada
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black uppercase tracking-wider text-neutral-600">
                    Cota Diaria Ativa
                  </div>
                  <div className="text-lg font-black text-[#381af8]">
                    {isAuthorizedIssuer ? `${issuerDailyLimit} Pontos / Dia` : "0 Pontos"}
                  </div>
                </div>
              </div>

              {/* Formulario de Cadastro de Nova Coordenadora */}
              <div className="mt-4 p-5 bg-[#f9f1f5] rounded-2xl border-2 border-neutral-300">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-black text-black flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-[#381af8]" />
                      Cadastrar Nova Carteira de Coordenadora On-Chain
                    </h3>
                    <p className="text-xs font-bold text-neutral-700 mt-0.5">
                      Autorize a carteira da universidade ou de um jurado para que ele possa emitir pontos.
                    </p>
                  </div>
                  <Tooltip
                    title="Registro de Coordenador"
                    content="Dispara a instrucao registerIssuer no contrato. Uma PDA issuer e criada e a carteira ganha cota propria de emissao."
                  />
                </div>

                <form onSubmit={handleRegisterCoordinator} className="space-y-3 mt-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        required
                        value={newCoordinatorInput}
                        onChange={(e) => setNewCoordinatorInput(e.target.value)}
                        placeholder="Cole o endereco da carteira da coordenadora (Solana)"
                        className="w-full px-4 py-3 rounded-xl border-2 border-neutral-400 text-xs font-black text-black bg-white focus:outline-none focus:border-[#381af8]"
                      />
                    </div>

                    {wallet.publicKey && (
                      <button
                        type="button"
                        onClick={() => setNewCoordinatorInput(wallet.publicKey?.toBase58() || "")}
                        className="px-4 py-3 bg-white border-2 border-neutral-400 hover:border-black text-xs font-black text-black rounded-xl transition-colors whitespace-nowrap"
                      >
                        Usar Carteira Conectada
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-full sm:w-48">
                      <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
                        Cota Diaria (PTS):
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="10000"
                        value={newQuotaInput}
                        onChange={(e) => setNewQuotaInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border-2 border-neutral-400 text-xs font-black text-black bg-white focus:outline-none focus:border-[#381af8]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full sm:flex-1 sm:mt-5 py-3 px-6 rounded-xl bg-[#381af8] text-white font-black text-xs shadow hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4 text-white" />
                      {isProcessing ? "Registrando On-Chain..." : "Autorizar Coordenadora no Contrato"}
                    </button>
                  </div>
                </form>

                {/* Lista de Coordenadoras Cadastradas */}
                <div className="mt-4 pt-3 border-t border-neutral-300">
                  <div className="text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-black" />
                    Coordenadoras Registradas no Ecossistema:
                  </div>
                  <div className="space-y-1.5">
                    {registeredIssuersList.map((addr) => (
                      <div
                        key={addr}
                        className="p-2 bg-white rounded-lg border border-neutral-300 text-xs font-black text-black flex items-center justify-between"
                      >
                        <span className="font-mono">{addr}</span>
                        {addr === CONTRACT_CONFIG.issuerAuthority && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-neutral-200 rounded">
                            Master
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Fila de Aprovacao de Missoes */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-neutral-300 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black text-black">
                    Fila de Aprovacao de Missoes (1 Clique)
                  </h2>
                  <p className="text-sm font-bold text-neutral-700">
                    Solicitacoes enviadas pelos estudantes. Nao requer digitacao manual de carteiras.
                  </p>
                </div>
                <Tooltip
                  title="Aprovacao Automatizada"
                  content="Qualquer coordenadora autorizada pode clicar em 'Aprovar e Emitir' para homologar os pontos on-chain."
                />
              </div>

              {isLoadingSubmissions ? (
                <div className="p-8 text-center text-sm font-black text-neutral-700">
                  Atualizando fila de submissoes...
                </div>
              ) : submissions.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-neutral-300 text-sm font-black text-neutral-600">
                  Nenhuma solicitacao de missao pendente no momento.
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl border-2 border-neutral-300 bg-white hover:border-black transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-black">{sub.missionTitle}</span>
                          <span className="px-2 py-0.5 text-xs font-black rounded bg-[#fc67f4]/20 border border-[#fc67f4] text-black">
                            +{sub.points} PTS
                          </span>
                        </div>

                        <div className="text-xs font-bold text-neutral-700">
                          Carteira do Aluno: <span className="font-mono text-black font-black">{sub.studentAddress}</span>
                        </div>

                        <div className="text-xs font-extrabold text-neutral-900 bg-[#f9f1f5] p-2 rounded-lg border border-neutral-300">
                          {sub.proofNote} ({sub.timestamp})
                        </div>
                      </div>

                      <button
                        onClick={() => handleApproveAndIssue(sub)}
                        disabled={isProcessing}
                        className="px-6 py-3.5 rounded-xl bg-[#381af8] text-white font-black text-xs shadow hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <Check className="w-4 h-4 text-white" />
                        Aprovar e Emitir On-Chain
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Barra Mobile */}
      {viewMode === "student" && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-neutral-300 px-4 py-3 sm:hidden flex items-center justify-around">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center ${activeTab === "dashboard" ? "text-[#381af8]" : "text-black"}`}
          >
            <LayoutDashboard className="w-6 h-6" strokeWidth={activeTab === "dashboard" ? 3 : 2} />
            <span className="text-xs font-black mt-1">Saldo</span>
          </button>

          <button
            onClick={() => setActiveTab("missions")}
            className={`flex flex-col items-center ${activeTab === "missions" ? "text-[#381af8]" : "text-black"}`}
          >
            <Award className="w-6 h-6" strokeWidth={activeTab === "missions" ? 3 : 2} />
            <span className="text-xs font-black mt-1">Missoes</span>
          </button>

          <button
            onClick={() => setActiveTab("rewards")}
            className={`flex flex-col items-center ${activeTab === "rewards" ? "text-[#381af8]" : "text-black"}`}
          >
            <Gift className="w-6 h-6" strokeWidth={activeTab === "rewards" ? 3 : 2} />
            <span className="text-xs font-black mt-1">Loja</span>
          </button>

          <button
            onClick={() => setActiveTab("ranking")}
            className={`flex flex-col items-center ${activeTab === "ranking" ? "text-[#381af8]" : "text-black"}`}
          >
            <Trophy className="w-6 h-6" strokeWidth={activeTab === "ranking" ? 3 : 2} />
            <span className="text-xs font-black mt-1">Ranking</span>
          </button>
        </nav>
      )}
    </div>
  );
}
