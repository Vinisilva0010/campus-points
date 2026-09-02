import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import devnetConfig from "@/constants/devnet-config.json";
import idl from "@/constants/campus_points.json";

class NodeWallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if ("version" in tx) {
      tx.sign([this.payer]);
    } else {
      tx.partialSign(this.payer);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map((t) => {
      if ("version" in t) {
        t.sign([this.payer]);
      } else {
        t.partialSign(this.payer);
      }
      return t;
    });
  }

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}

function getAuthorityKeypair(): Keypair {
  const walletPath = path.resolve(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")));
  return Keypair.fromSecretKey(secretKey);
}

const REGISTRY_FILE = path.resolve(process.cwd(), ".issuers_registry.json");

function getRegisteredIssuers(): string[] {
  if (!fs.existsSync(REGISTRY_FILE)) {
    return [devnetConfig.issuerAuthority];
  }
  try {
    const list = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
    return Array.from(new Set([devnetConfig.issuerAuthority, ...list]));
  } catch {
    return [devnetConfig.issuerAuthority];
  }
}

function saveRegisteredIssuer(address: string) {
  const current = getRegisteredIssuers();
  if (!current.includes(address)) {
    current.push(address);
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(current, null, 2));
  }
}

export async function GET() {
  return NextResponse.json({ issuers: getRegisteredIssuers() });
}

export async function POST(req: Request) {
  try {
    const { action, targetWallet, points, dailyLimit } = await req.json();
    const rpcUrl = "https://devnet.helius-rpc.com/?api-key=99a74efc-f197-45d6-a462-1ef1672319aa";
    const connection = new Connection(rpcUrl, "confirmed");

    const authorityKeypair = getAuthorityKeypair();
    const wallet = new NodeWallet(authorityKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new Program(idl as any, provider);

    const programId = new PublicKey(devnetConfig.programId);
    const mintPubkey = new PublicKey(devnetConfig.mint);
    const targetPubkey = new PublicKey(targetWallet);

    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
    const [targetIssuerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("issuer"), targetPubkey.toBuffer()],
      programId
    );

    if (action === "register_issuer") {
      const existing = await connection.getAccountInfo(targetIssuerPda, "confirmed");
      if (existing) {
        saveRegisteredIssuer(targetPubkey.toBase58());
        return NextResponse.json({
          success: true,
          tx: "already_registered_onchain",
          issuer: targetPubkey.toBase58(),
        });
      }

      const quota = dailyLimit ? new BN(Number(dailyLimit)) : new BN(1000);
      const tx = await (program.methods as any)
        .registerIssuer(quota, true)
        .accounts({
          authority: authorityKeypair.publicKey,
          campusConfig: configPda,
          issuerAuthority: targetPubkey,
          issuerAccount: targetIssuerPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      saveRegisteredIssuer(targetPubkey.toBase58());
      return NextResponse.json({ success: true, tx, issuer: targetPubkey.toBase58() });
    }

    if (action === "subsidized_issue") {
      const [authIssuerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("issuer"), authorityKeypair.publicKey.toBuffer()],
        programId
      );

      const recipientAta = getAssociatedTokenAddressSync(
        mintPubkey,
        targetPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await (program.methods as any)
        .issuePoints(new BN(Number(points)))
        .accounts({
          issuer: authorityKeypair.publicKey,
          issuerAccount: authIssuerPda,
          campusConfig: configPda,
          mint: mintPubkey,
          recipient: targetPubkey,
          recipientTokenAccount: recipientAta,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return NextResponse.json({ success: true, tx });
    }

    return NextResponse.json({ error: "Acao desconhecida" }, { status: 400 });
  } catch (err: any) {
    const msg = err.logs ? err.logs.join(" | ") : err.message || JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
