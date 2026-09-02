import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const rpcUrl = "https://devnet.helius-rpc.com/?api-key=99a74efc-f197-45d6-a462-1ef1672319aa";
  const connection = new anchor.web3.Connection(rpcUrl, "confirmed");

  const walletPath = path.resolve(
    process.env.HOME || "",
    ".config/solana/id.json"
  );
  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync(walletPath, "utf-8"))
  );
  const keypair = anchor.web3.Keypair.fromSecretKey(secretKey);
  const wallet = new anchor.Wallet(keypair);

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idlPath = path.resolve("./target/idl/campus_points.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new anchor.web3.PublicKey(
    "53sEPq9sSPaaYHYf3MdjMXjqMPpRBLpxTSyWs7EMo5Bb"
  );
  const program = new Program(idl, provider);

  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Program ID:", programId.toBase58());

  // Gera e persiste keypair da Mint
  const mintKeypairPath = path.resolve("./target/mint-keypair.json");
  let mintKeypair: anchor.web3.Keypair;
  if (fs.existsSync(mintKeypairPath)) {
    const mintSecret = Uint8Array.from(
      JSON.parse(fs.readFileSync(mintKeypairPath, "utf-8"))
    );
    mintKeypair = anchor.web3.Keypair.fromSecretKey(mintSecret);
    console.log("Mint existente carregada:", mintKeypair.publicKey.toBase58());
  } else {
    mintKeypair = anchor.web3.Keypair.generate();
    fs.writeFileSync(
      mintKeypairPath,
      JSON.stringify(Array.from(mintKeypair.secretKey))
    );
    console.log("Nova Mint gerada:", mintKeypair.publicKey.toBase58());
  }

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );

  const [issuerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("issuer"), wallet.publicKey.toBuffer()],
    programId
  );

  console.log("Config PDA:", configPda.toBase58());
  console.log("Issuer PDA:", issuerPda.toBase58());

  // 1. Initialize
  try {
    const existingConfig = await connection.getAccountInfo(configPda);
    if (!existingConfig) {
      console.log("Inicializando protocolo e Mint Non-Transferable...");
      const tx = await program.methods
        .initialize()
        .accounts({
          authority: wallet.publicKey,
          campusConfig: configPda,
          mint: mintKeypair.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mintKeypair])
        .rpc();
      console.log("Initialize TX:", tx);
    } else {
      console.log("CampusConfig ja inicializado anteriormente.");
    }
  } catch (err: any) {
    console.error("Erro no initialize:", err.message || err);
    throw err;
  }

  // 2. Register Issuer
  try {
    console.log("Registrando carteira de deploy como Emissor institucional...");
    const tx = await program.methods
      .registerIssuer(new anchor.BN(1000), true)
      .accounts({
        authority: wallet.publicKey,
        campusConfig: configPda,
        issuerAuthority: wallet.publicKey,
        issuerAccount: issuerPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Register Issuer TX:", tx);
  } catch (err: any) {
    console.log("Emissor ja registrado ou atualizado:", err.message || err);
  }

  // 3. Create Rewards (Catalogo)
  const initialRewards = [
    { id: 1, cost: 30, name: "Café Especial no DCE" },
    { id: 2, cost: 75, name: "Crédito R$ 15 em Xerox" },
    { id: 3, cost: 150, name: "Camiseta Atlética 2026" },
  ];

  for (const reward of initialRewards) {
    const rewardIdBn = new anchor.BN(reward.id);
    const [rewardPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reward"), rewardIdBn.toArrayLike(Buffer, "le", 8)],
      programId
    );
    try {
      const rewardAccount = await connection.getAccountInfo(rewardPda);
      if (!rewardAccount) {
        console.log(`Criando recompensa #${reward.id}: ${reward.name} (${reward.cost} pts)...`);
        const tx = await program.methods
          .createReward(rewardIdBn, new anchor.BN(reward.cost))
          .accounts({
            authority: wallet.publicKey,
            campusConfig: configPda,
            reward: rewardPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        console.log(`Reward #${reward.id} criada. TX:`, tx);
      } else {
        console.log(`Reward #${reward.id} ja existe.`);
      }
    } catch (err: any) {
      console.error(`Erro ao criar Reward #${reward.id}:`, err.message || err);
    }
  }

  const devnetConfig = {
    programId: programId.toBase58(),
    mint: mintKeypair.publicKey.toBase58(),
    configPda: configPda.toBase58(),
    issuerAuthority: wallet.publicKey.toBase58(),
    issuerPda: issuerPda.toBase58(),
    rewards: initialRewards,
  };

  fs.writeFileSync(
    path.resolve("./target/devnet-config.json"),
    JSON.stringify(devnetConfig, null, 2)
  );
  console.log("Setup finalizado com sucesso!");
  console.log("Config salva em: target/devnet-config.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
