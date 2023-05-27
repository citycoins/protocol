import { Account, Chain } from "./deps.ts";
import { CCD001DirectExecute } from "../models/extensions/ccd001-direct-execute.model.ts";
import { BaseDao } from "../models/base-dao.model.ts";

// Toggle startBlock to align starting block height - this varies with contracts (and nested contracts) in toml
// export const START_BLOCK_BASE_DAO = 100; // or 99
export const START_BLOCK_CCD005 = 6; // 6 or 7
export const START_BLOCK_CCD006 = 9; // or 9 or 10

export const ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

export const BASE_DAO = ADDRESS.concat(".base-dao");

export const EXTENSIONS = {
  CCD001_DIRECT_EXECUTE: ADDRESS.concat(".ccd001-direct-execute"),
  CCD002_TREASURY_MIA_MINING: ADDRESS.concat(".ccd002-treasury-mia-mining"),
  CCD002_TREASURY_MIA_STACKING: ADDRESS.concat(".ccd002-treasury-mia-stacking"),
  CCD002_TREASURY_NYC_MINING: ADDRESS.concat(".ccd002-treasury-nyc-mining"),
  CCD002_TREASURY_NYC_STACKING: ADDRESS.concat(".ccd002-treasury-nyc-stacking"),
  CCD003_USER_REGISTRY: ADDRESS.concat(".ccd003-user-registry"),
  CCD004_CITY_REGISTRY: ADDRESS.concat(".ccd004-city-registry"),
  CCD005_CITY_DATA: ADDRESS.concat(".ccd005-city-data"),
  CCD006_CITYCOIN_MINING: ADDRESS.concat(".ccd006-citycoin-mining"),
  CCD006_CITYCOIN_MINING_V2: ADDRESS.concat(".ccd006-citycoin-mining-v2"),
  CCD007_CITYCOIN_STACKING: ADDRESS.concat(".ccd007-citycoin-stacking"),
  CCD008_CITY_ACTIVATION: ADDRESS.concat(".ccd008-city-activation"),
  CCD009_AUTH_V2_ADAPTER: ADDRESS.concat(".ccd009-auth-v2-adapter"),
  CCD010_CORE_V2_ADAPTER: ADDRESS.concat(".ccd010-core-v2-adapter"),
};

export const PROPOSALS = {
  CCIP_012: ADDRESS.concat(".ccip012-bootstrap"),
  CCIP_013: ADDRESS.concat(".ccip013-migration"),
  CCIP_014: ADDRESS.concat(".ccip014-pox-3"),
  TEST_CCD001_DIRECT_EXECUTE_001: ADDRESS.concat(".test-ccd001-direct-execute-001"),
  TEST_CCD001_DIRECT_EXECUTE_002: ADDRESS.concat(".test-ccd001-direct-execute-002"),
  TEST_CCD001_DIRECT_EXECUTE_003: ADDRESS.concat(".test-ccd001-direct-execute-003"),
  TEST_CCD002_TREASURY_001: ADDRESS.concat(".test-ccd002-treasury-001"),
  TEST_CCD002_TREASURY_002: ADDRESS.concat(".test-ccd002-treasury-002"),
  TEST_CCD002_TREASURY_003: ADDRESS.concat(".test-ccd002-treasury-003"),
  TEST_CCD002_TREASURY_004: ADDRESS.concat(".test-ccd002-treasury-004"),
  TEST_CCD002_TREASURY_005: ADDRESS.concat(".test-ccd002-treasury-005"),
  TEST_CCD002_TREASURY_006: ADDRESS.concat(".test-ccd002-treasury-006"),
  TEST_CCD002_TREASURY_007: ADDRESS.concat(".test-ccd002-treasury-007"),
  TEST_CCD002_TREASURY_008: ADDRESS.concat(".test-ccd002-treasury-008"),
  TEST_CCD002_TREASURY_009: ADDRESS.concat(".test-ccd002-treasury-009"),
  TEST_CCD002_TREASURY_010: ADDRESS.concat(".test-ccd002-treasury-010"),
  TEST_CCD002_TREASURY_011: ADDRESS.concat(".test-ccd002-treasury-011"),
  TEST_CCD002_TREASURY_012: ADDRESS.concat(".test-ccd002-treasury-012"),
  TEST_CCD003_USER_REGISTRY_001: ADDRESS.concat(".test-ccd003-user-registry-001"),
  TEST_CCD003_USER_REGISTRY_002: ADDRESS.concat(".test-ccd003-user-registry-002"),
  TEST_CCD003_USER_REGISTRY_003: ADDRESS.concat(".test-ccd003-user-registry-003"),
  TEST_CCD004_CITY_REGISTRY_001: ADDRESS.concat(".test-ccd004-city-registry-001"),
  TEST_CCD004_CITY_REGISTRY_002: ADDRESS.concat(".test-ccd004-city-registry-002"),
  TEST_CCD005_CITY_DATA_001: ADDRESS.concat(".test-ccd005-city-data-001"),
  TEST_CCD005_CITY_DATA_002: ADDRESS.concat(".test-ccd005-city-data-002"),
  TEST_CCD005_CITY_DATA_003: ADDRESS.concat(".test-ccd005-city-data-003"),
  TEST_CCD005_CITY_DATA_004: ADDRESS.concat(".test-ccd005-city-data-004"),
  TEST_CCD005_CITY_DATA_005: ADDRESS.concat(".test-ccd005-city-data-005"),
  TEST_CCD005_CITY_DATA_006: ADDRESS.concat(".test-ccd005-city-data-006"),
  TEST_CCD005_CITY_DATA_007: ADDRESS.concat(".test-ccd005-city-data-007"),
  TEST_CCD005_CITY_DATA_008: ADDRESS.concat(".test-ccd005-city-data-008"),
  TEST_CCD005_CITY_DATA_009: ADDRESS.concat(".test-ccd005-city-data-009"),
  TEST_CCD005_CITY_DATA_010: ADDRESS.concat(".test-ccd005-city-data-010"),
  TEST_CCD005_CITY_DATA_011: ADDRESS.concat(".test-ccd005-city-data-011"),
  TEST_CCD005_CITY_DATA_012: ADDRESS.concat(".test-ccd005-city-data-012"),
  TEST_CCD005_CITY_DATA_013: ADDRESS.concat(".test-ccd005-city-data-013"),
  TEST_CCD005_CITY_DATA_014: ADDRESS.concat(".test-ccd005-city-data-014"),
  TEST_CCD005_CITY_DATA_015: ADDRESS.concat(".test-ccd005-city-data-015"),
  TEST_CCD005_CITY_DATA_016: ADDRESS.concat(".test-ccd005-city-data-016"),
  TEST_CCD005_CITY_DATA_017: ADDRESS.concat(".test-ccd005-city-data-017"),
  TEST_CCD005_CITY_DATA_018: ADDRESS.concat(".test-ccd005-city-data-018"),
  TEST_CCD005_CITY_DATA_019: ADDRESS.concat(".test-ccd005-city-data-019"),
  TEST_CCD006_CITY_MINING_001: ADDRESS.concat(".test-ccd006-citycoin-mining-001"),
  TEST_CCD006_CITY_MINING_002: ADDRESS.concat(".test-ccd006-citycoin-mining-002"),
  TEST_CCD006_CITY_MINING_003: ADDRESS.concat(".test-ccd006-citycoin-mining-003"),
  TEST_CCD006_CITY_MINING_004: ADDRESS.concat(".test-ccd006-citycoin-mining-004"),
  TEST_CCD006_CITY_MINING_005: ADDRESS.concat(".test-ccd006-citycoin-mining-005"),
  TEST_CCD006_CITY_MINING_V2_001: ADDRESS.concat(".test-ccd006-citycoin-mining-v2-001"),
  TEST_CCD006_CITY_MINING_V2_002: ADDRESS.concat(".test-ccd006-citycoin-mining-v2-002"),
  TEST_CCD006_CITY_MINING_V2_003: ADDRESS.concat(".test-ccd006-citycoin-mining-v2-003"),
  TEST_CCD006_CITY_MINING_V2_004: ADDRESS.concat(".test-ccd006-citycoin-mining-v2-004"),
  TEST_CCD006_CITY_MINING_V2_005: ADDRESS.concat(".test-ccd006-citycoin-mining-v2-005"),
  TEST_CCD007_CITY_STACKING_001: ADDRESS.concat(".test-ccd007-citycoin-stacking-001"),
  TEST_CCD007_CITY_STACKING_002: ADDRESS.concat(".test-ccd007-citycoin-stacking-002"),
  TEST_CCD007_CITY_STACKING_003: ADDRESS.concat(".test-ccd007-citycoin-stacking-003"),
  TEST_CCD007_CITY_STACKING_007: ADDRESS.concat(".test-ccd007-citycoin-stacking-007"),
  TEST_CCD007_CITY_STACKING_008: ADDRESS.concat(".test-ccd007-citycoin-stacking-008"),
  TEST_CCD007_CITY_STACKING_009: ADDRESS.concat(".test-ccd007-citycoin-stacking-009"),
  TEST_CCD007_CITY_STACKING_010: ADDRESS.concat(".test-ccd007-citycoin-stacking-010"),
  TEST_CCD007_CITY_STACKING_011: ADDRESS.concat(".test-ccd007-citycoin-stacking-011"),
  TEST_CCD007_CITY_STACKING_012: ADDRESS.concat(".test-ccd007-citycoin-stacking-012"),
  TEST_CCD011_STACKING_PAYOUTS_001: ADDRESS.concat(".test-ccd011-stacking-payouts-001"),
  TEST_CCIP014_POX3_001: ADDRESS.concat(".test-ccip014-pox-3-001"),
};

export const EXTERNAL = {
  FT_MIA: ADDRESS.concat(".test-ccext-governance-token-mia"),
  FT_NYC: ADDRESS.concat(".test-ccext-governance-token-nyc"),
  NFT_MIA: ADDRESS.concat(".test-ccext-nft-mia"),
  NFT_NYC: ADDRESS.concat(".test-ccext-nft-nyc"),
};

export const CITYCOINS = {
  MIA_TOKEN: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2",
  NYC_TOKEN: "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2",
};

export const passProposal = (chain: Chain, accounts: Map<string, Account>, proposal: string): any => {
  const sender = accounts.get("deployer")!;
  const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
  const approver1 = accounts.get("wallet_1")!;
  const approver2 = accounts.get("wallet_2")!;
  const approver3 = accounts.get("wallet_3")!;
  const block = chain.mineBlock([ccd001DirectExecute.directExecute(approver1, proposal), ccd001DirectExecute.directExecute(approver2, proposal), ccd001DirectExecute.directExecute(approver3, proposal)]);
  // console.log(`passProposal at height: ${block.height}`);
  // console.log(`proposal: ${proposal}`);
  // console.log(`block:\n${JSON.stringify(block, null, 2)}`);
  return block;
};

export const constructAndPassProposal = (chain: Chain, accounts: Map<string, Account>, proposal: string): any => {
  const sender = accounts.get("deployer")!;
  const baseDao = new BaseDao(chain, sender);
  const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
  const approver1 = accounts.get("wallet_1")!;
  const approver2 = accounts.get("wallet_2")!;
  const approver3 = accounts.get("wallet_3")!;
  const block = chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012), ccd001DirectExecute.directExecute(approver1, proposal), ccd001DirectExecute.directExecute(approver2, proposal), ccd001DirectExecute.directExecute(approver3, proposal)]);
  // console.log(`constructAndPassProposal at height: ${block.height}`);
  // console.log(`proposal: ${proposal}`);
  // console.log(`block:\n${JSON.stringify(block, null, 2)}`);
  return block;
};

// reusable city data

export type CityData = {
  cityId: number;
  cityName: string;
  treasuryV1Contract: string;
  treasuryV1Id: number;
  treasuryV1Name: string;
  treasuryV2Contract: string;
  treasuryV2Id: number;
  treasuryV2Name: string;
};

export const mia: CityData = {
  cityId: 1,
  cityName: "mia",
  treasuryV1Contract: "ccd002-treasury-mia-mining",
  treasuryV1Id: 1,
  treasuryV1Name: "mining",
  treasuryV2Contract: "ccd002-treasury-mia-mining-v2",
  treasuryV2Id: 2,
  treasuryV2Name: "mining-v2",
};

export const nyc: CityData = {
  cityId: 2,
  cityName: "nyc",
  treasuryV1Contract: "ccd002-treasury-nyc-mining",
  treasuryV1Id: 1,
  treasuryV1Name: "mining",
  treasuryV2Contract: "ccd002-treasury-nyc-mining-v2",
  treasuryV2Id: 2,
  treasuryV2Name: "mining-v2",
};
