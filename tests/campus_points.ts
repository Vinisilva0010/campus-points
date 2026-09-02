import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { CampusPoints } from "../target/types/campus_points";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { expect } from "chai";

describe("campus_points", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = (anchor.workspace.CampusPoints ||
    (anchor.workspace as any).campus_points) as Program<CampusPoints>;

  const mintKeypair = anchor.web3.Keypair.generate();
  const issuer = anchor.web3.Keypair.generate();
  const studentA = anchor.web3.Keypair.generate();
  const studentB = anchor.web3.Keypair.generate();

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const [issuerPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("issuer"), issuer.publicKey.toBuffer()],
    program.programId
  );

  const studentAAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    studentA.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const studentBAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    studentB.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const rewardId = new anchor.BN(1);
  const [rewardPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("reward"), rewardId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  before(async () => {
    const fundTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: issuer.publicKey,
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
      }),
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: studentA.publicKey,
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
      }),
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: studentB.publicKey,
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(fundTx);
  });

  it("1. Inicializa o protocolo e a Mint Non-Transferable", async () => {
    await program.methods
      .initialize()
      .accounts({
        authority: provider.wallet.publicKey,
        campusConfig: configPda,
        mint: mintKeypair.publicKey,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair])
      .rpc();

    const configAccount = await program.account.campusConfig.fetch(configPda);
    expect(configAccount.authority.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58()
    );
    expect(configAccount.mint.toBase58()).to.equal(
      mintKeypair.publicKey.toBase58()
    );
    expect(configAccount.totalIssued.toNumber()).to.equal(0);
    expect(configAccount.totalBurned.toNumber()).to.equal(0);
  });

  it("2. Cadastra um emissor institucional com limite diario", async () => {
    await program.methods
      .registerIssuer(new anchor.BN(500), true)
      .accounts({
        authority: provider.wallet.publicKey,
        campusConfig: configPda,
        issuerAuthority: issuer.publicKey,
        issuerAccount: issuerPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const issuerAccount = await program.account.issuerAccount.fetch(issuerPda);
    expect(issuerAccount.authority.toBase58()).to.equal(
      issuer.publicKey.toBase58()
    );
    expect(issuerAccount.dailyLimit.toNumber()).to.equal(500);
    expect(issuerAccount.isActive).to.be.true;
  });

  it("3. Emissor emite 100 pontos para o Estudante A", async () => {
    await program.methods
      .issuePoints(new anchor.BN(100))
      .accounts({
        issuer: issuer.publicKey,
        issuerAccount: issuerPda,
        campusConfig: configPda,
        mint: mintKeypair.publicKey,
        recipient: studentA.publicKey,
        recipientTokenAccount: studentAAta,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();

    const balance = await provider.connection.getTokenAccountBalance(
      studentAAta
    );
    expect(balance.value.uiAmount).to.equal(100);

    const issuerAccount = await program.account.issuerAccount.fetch(issuerPda);
    expect(issuerAccount.issuedToday.toNumber()).to.equal(100);
  });

  it("4. Prova Soulbound: Estudante A tenta transferir para Estudante B e a rede rejeita", async () => {
    // Cria ATA do Estudante B para receber
    const createAtaTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        studentB.publicKey,
        studentBAta,
        studentB.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await anchor.web3.sendAndConfirmTransaction(provider.connection, createAtaTx, [
      studentB,
    ]);

    let transferFailed = false;
    try {
      const transferTx = new anchor.web3.Transaction().add(
        createTransferInstruction(
          studentAAta,
          studentBAta,
          studentA.publicKey,
          10,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );
      await anchor.web3.sendAndConfirmTransaction(
        provider.connection,
        transferTx,
        [studentA]
      );
    } catch (err) {
      transferFailed = true;
    }

    expect(
      transferFailed,
      "A transferencia deveria ter sido bloqueada pela extensao NonTransferable"
    ).to.be.true;
  });

  it("5. Autoridade cadastra uma recompensa no catalogo", async () => {
    await program.methods
      .createReward(rewardId, new anchor.BN(30))
      .accounts({
        authority: provider.wallet.publicKey,
        campusConfig: configPda,
        reward: rewardPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const rewardAccount = await program.account.rewardCatalog.fetch(rewardPda);
    expect(rewardAccount.rewardId.toNumber()).to.equal(1);
    expect(rewardAccount.cost.toNumber()).to.equal(30);
    expect(rewardAccount.isAvailable).to.be.true;
  });

  it("6. Estudante A queima 30 pontos e resgata a recompensa", async () => {
    await program.methods
      .redeemReward(rewardId)
      .accounts({
        student: studentA.publicKey,
        reward: rewardPda,
        campusConfig: configPda,
        mint: mintKeypair.publicKey,
        studentTokenAccount: studentAAta,
        token2022Program: TOKEN_2022_PROGRAM_ID,
      })
      .signers([studentA])
      .rpc();

    const balance = await provider.connection.getTokenAccountBalance(
      studentAAta
    );
    expect(balance.value.uiAmount).to.equal(70);

    const rewardAccount = await program.account.rewardCatalog.fetch(rewardPda);
    expect(rewardAccount.totalRedeemed).to.equal(1);

    const configAccount = await program.account.campusConfig.fetch(configPda);
    expect(configAccount.totalBurned.toNumber()).to.equal(30);
  });
});
