export const ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

export const BASE_DAO = ADDRESS.concat(".base-dao");

export const EXTENSIONS = {
  CCD001_DIRECT_EXECUTE: ADDRESS.concat(".ccd001-direct-execute"),
  CCD002_TREASURY_MIA: ADDRESS.concat(".ccd002-treasury-mia"),
  CCD002_TREASURY_NYC: ADDRESS.concat(".ccd002-treasury-nyc"),
};

export const PROPOSALS = {
  CCIP_012: ADDRESS.concat(".ccip012-bootstrap"),
  TEST_CCD001_DIRECT_EXECUTE_001: ADDRESS.concat(".ccip-test-direct-execute-001"),
  TEST_CCD001_DIRECT_EXECUTE_002: ADDRESS.concat(".ccip-test-direct-execute-002"),
  TEST_CCD001_DIRECT_EXECUTE_003: ADDRESS.concat(".ccip-test-direct-execute-003"),
  TEST_CCD002_TREASURY_001: ADDRESS.concat(".ccip-test-treasury-001"),
  TEST_CCD002_TREASURY_002: ADDRESS.concat(".ccip-test-treasury-002"),
  TEST_CCD002_TREASURY_003: ADDRESS.concat(".ccip-test-treasury-003"),
  TEST_CCD002_TREASURY_004: ADDRESS.concat(".ccip-test-treasury-004")
};

export const EXTERNAL = {
  FT_MIA: ADDRESS.concat(".ccext-governance-token-mia"),
  FT_NYC: ADDRESS.concat(".ccext-governance-token-nyc"),
  NFT_MIA: ADDRESS.concat(".ccext-nft-mia"),
  NFT_NYC: ADDRESS.concat(".ccext-nft-nyc")
};
