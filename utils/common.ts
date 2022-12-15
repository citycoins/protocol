import { Account, Chain } from "./deps.ts";
import { CCD001DirectExecute } from "../models/extensions/ccd001-direct-execute.model.ts";
import { BaseDao } from "../models/base-dao.model.ts";

export const ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

export const BASE_DAO = ADDRESS.concat(".base-dao");

export const EXTENSIONS = {
  CCD001_DIRECT_EXECUTE: ADDRESS.concat(".ccd001-direct-execute"),
  CCD002_TREASURY_MIA: ADDRESS.concat(".ccd002-treasury-mia"),
  CCD002_TREASURY_NYC: ADDRESS.concat(".ccd002-treasury-nyc"),
  CCD003_USER_REGISTRY: ADDRESS.concat(".ccd003-user-registry"),
  CCD004_CITY_REGISTRY: ADDRESS.concat(".ccd004-city-registry"),
};

export const PROPOSALS = {
  CCIP_012: ADDRESS.concat(".ccip012-bootstrap"),
  TEST_CCD001_DIRECT_EXECUTE_001: ADDRESS.concat(
    ".test-ccd001-direct-execute-001"
  ),
  TEST_CCD001_DIRECT_EXECUTE_002: ADDRESS.concat(
    ".test-ccd001-direct-execute-002"
  ),
  TEST_CCD001_DIRECT_EXECUTE_003: ADDRESS.concat(
    ".test-ccd001-direct-execute-003"
  ),
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
  TEST_CCD003_USER_REGISTRY_001: ADDRESS.concat(
    ".test-ccd003-user-registry-001"
  ),
  TEST_CCD003_USER_REGISTRY_002: ADDRESS.concat(
    ".test-ccd003-user-registry-002"
  ),
  TEST_CCD003_USER_REGISTRY_003: ADDRESS.concat(
    ".test-ccd003-user-registry-003"
  ),
  TEST_CCD004_CITY_REGISTRY_001: ADDRESS.concat(
    ".test-ccd004-city-registry-001"
  ),
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
  TEST_CCD006_CITY_MINING_001: ADDRESS.concat(".test-ccd006-city-mining-001"),
  TEST_CCD006_CITY_MINING_002: ADDRESS.concat(".test-ccd006-city-mining-002"),
};

export const EXTERNAL = {
  FT_MIA: ADDRESS.concat(".test-ccext-governance-token-mia"),
  FT_NYC: ADDRESS.concat(".test-ccext-governance-token-nyc"),
  NFT_MIA: ADDRESS.concat(".test-ccext-nft-mia"),
  NFT_NYC: ADDRESS.concat(".test-ccext-nft-nyc"),
};

export const passProposal = (
  chain: Chain,
  accounts: Map<string, Account>,
  proposal: string
): any => {
  const sender = accounts.get("deployer")!;
  const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
  const approver1 = accounts.get("wallet_1")!;
  const approver2 = accounts.get("wallet_2")!;
  const approver3 = accounts.get("wallet_3")!;
  const { receipts } = chain.mineBlock([
    ccd001DirectExecute.directExecute(approver1, proposal),
    ccd001DirectExecute.directExecute(approver2, proposal),
    ccd001DirectExecute.directExecute(approver3, proposal),
  ]);
  return receipts;
};

export const constructAndPassProposal = (
  chain: Chain,
  accounts: Map<string, Account>,
  proposal: string
): any => {
  const sender = accounts.get("deployer")!;
  const baseDao = new BaseDao(chain, sender);
  const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
  const approver1 = accounts.get("wallet_1")!;
  const approver2 = accounts.get("wallet_2")!;
  const approver3 = accounts.get("wallet_3")!;
  const { receipts } = chain.mineBlock([
    baseDao.construct(sender, PROPOSALS.CCIP_012),
    ccd001DirectExecute.directExecute(approver1, proposal),
    ccd001DirectExecute.directExecute(approver2, proposal),
    ccd001DirectExecute.directExecute(approver3, proposal),
  ]);
  // console.log(receipts);
  return receipts;
};
