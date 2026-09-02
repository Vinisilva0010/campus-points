import devnetConfig from "./devnet-config.json";
import idl from "./campus_points.json";

export const CONTRACT_CONFIG = {
  rpcUrl: "https://devnet.helius-rpc.com/?api-key=99a74efc-f197-45d6-a462-1ef1672319aa",
  programId: devnetConfig.programId,
  mint: devnetConfig.mint,
  configPda: devnetConfig.configPda,
  issuerAuthority: devnetConfig.issuerAuthority,
  issuerPda: devnetConfig.issuerPda,
  token2022ProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  rewards: devnetConfig.rewards,
};

export const IDL = idl;
