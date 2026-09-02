import { NextResponse } from "next/server";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import devnetConfig from "@/constants/devnet-config.json";
import idl from "@/constants/campus_points.json";

function getAuthorityWallet() {
  const walletPath = path.resolve(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")));
  return anchor.web3.Keypair.fromSecretKey(secretKey);
}

export async function POST(req: Request) {
  try {
    const { action, targetWallet, points } = await req.json();
    const rpcUrl = "https://devnet.helius-rpc.com/?api-key=99a74efc-f197-45d6-a462-1ef1672319aa";
    const connection = new anchor.web3.Connection(rpcUrl, "confirmed");
    const authorityKeypair = getAuthorityWallet();
    const wallet = new anchor.Wallet(authorityKeypair);
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

    // Acao 1: Registrar a carteira do jurado/avaliador como emissora oficial
    if (action === "register_issuer") {
      const tx = await (program.methods as any)
        .registerIssuer(new BN(1000), true)
        .accounts({
          authority: authorityKeypair.publicKey,
          campusConfig: configPda,
          issuerAuthority: targetPubkey,
          issuerAccount: targetIssuerPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      return NextResponse.json({ success: true, tx });
    }

    // Acao 2: Emissao subsidiada pela autoridade para quem nao tem Devnet SOL
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
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      return NextResponse.json({ success: true, tx });
    }

    return NextResponse.json({ error: "Acao desconhecida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || JSON.stringify(err) }, { status: 500 });
  }
}
