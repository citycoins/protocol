/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. MINING
 *    - mine
 * 2. CLAIMING
 *    - claim-mining-reward
 *    - set-reward-delay
 */
import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import {
  constructAndPassProposal,
  passProposal,
  PROPOSALS,
} from "../../utils/common.ts";
import {
  CCD006CityMining,
  ErrCode,
} from "../../models/extensions/ccd006-city-mining.model.ts";
import {
  CCD005CityData,
} from "../../models/extensions/ccd005-city-data.model.ts";
import { types } from "../../utils/deps.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const miaCityId = 1;
const miaCityName = "mia";
const miaTreasuryId = 1;
const miaMiningTreasuryName = "mining";
const miaTokenContract1Address = "mia-token-contract-1";
const miaTokenContract2Address = "mia-token-contract-2";
const miaTokenContract3Address = "mia-token-contract-3";
const miaStackingTreasury = 1;
const miaMiningTreasury = 2;

const nycCityId = 2;
const nycTreasuryId = 2;
const nycTreasuryName = "nyc-treasury";
const nycStackingTreasury = 1;
const nycMiningTreasury = 2;

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd006-city-mining: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(
      chain,
      sender,
      "ccd006-city-mining"
    );

    // act

    // assert
    ccd006CityMining
      .isDaoOrExtension()
      .result.expectErr()
      .expectUint(CCD006CityMining.ErrCode.ERR_UNAUTHORIZED);
  },
});

// =============================
// 1. MINING
// =============================

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if city name is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(
      chain,
      sender,
      "ccd006-city-mining"
    );

    // act
    const entries = [10, 10];
    const { receipts } = chain.mineBlock([
      ccd006CityMining.mine(sender, miaCityName, entries),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD006CityMining.ErrCode.ERR_CITY_ID_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if city name is not active",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(
      chain,
      sender,
      "ccd006-city-mining"
    );

    // act
    const entries = [10, 10];
    constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD004_CITY_REGISTRY_001
    );
    const block = chain.mineBlock([
      ccd006CityMining.mine(sender, miaCityName, entries),
    ]);

    // assert
    block.receipts[0].result
      .expectErr()
      .expectUint(CCD006CityMining.ErrCode.ERR_CITY_NOT_ACTIVATED);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if city details are not set",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(
      chain,
      sender,
      "ccd006-city-mining"
    );

    // act
    const entries = [10, 10];
    constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD004_CITY_REGISTRY_001
    );
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([
      ccd006CityMining.mine(sender, miaCityName, entries),
    ]);

    // assert
    block.receipts[0].result
      .expectErr()
      .expectUint(CCD006CityMining.ErrCode.ERR_CITY_TREASURY_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if not a valid extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );
    const ccd006CityMining = new CCD006CityMining(
      chain,
      sender,
      "ccd006-city-mining"
    );

    // act
    const entries = [10, 10];
    constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD004_CITY_REGISTRY_001
    );
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_001);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    ccd005CityData
      .getCityTreasuryId(miaCityId, miaMiningTreasuryName)
      .result.expectSome()
      .expectUint(1);
    ccd005CityData
      .getCityTreasuryName(miaCityId, miaTreasuryId)
      .result.expectSome()
      .expectAscii(miaMiningTreasuryName);
    const block = chain.mineBlock([
      ccd006CityMining.mine(sender, miaCityName, entries),
    ]);

    // assert
    block.receipts[0].result
      .expectErr()
      .expectUint(3000) // error thrown by user registry!
  },
});

// =============================
// 2. CLAIMING
// =============================
