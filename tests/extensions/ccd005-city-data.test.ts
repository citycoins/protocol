/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. CITY ACTIVATION TESTS
 *    - set-city-activation-status
 *    - set-city-activation-details
 *    - activate-city
 * 2. CITY DATA COINBASE TESTS
 *    - set-city-coinbase-thresholds
 *    - set-city-coinbase-amounts
 *    - set-city-coinbase-bonus-period
 * 3. CITY TREASURY TESTS
 *    - add-city-treasury
 * 4. CITY TOKEN CONTRACTS TESTS
 *    - add-city-token-contract
 *    - set-active-city-token-contract
 */
import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { START_BLOCK_CCD005, constructAndPassProposal, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD005CityData, ErrCode } from "../../models/extensions/ccd005-city-data.model.ts";
import { types } from "../../utils/deps.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const miaCityId = 1;
const miaTreasuryId = 1;
const miaTreasuryName = "mia-test";
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

const testExpectedCityDetails = (ccd005CityData: any, cityId: number, activated: number, delay: number, target: number, threshold: number) => {
  const expectedStats = {
    activated: types.uint(activated),
    delay: types.uint(delay),
    target: types.uint(target),
    threshold: types.uint(threshold),
  };
  assertEquals(ccd005CityData.getCityActivationDetails(cityId).result.expectSome().expectTuple(), expectedStats);
};

const testExpectedCoinbaseAmount = (ccd005CityData: any, cityId: number, coinbaseAmountBonus: number, coinbaseAmount1: number, coinbaseAmount2: number, coinbaseAmount3: number, coinbaseAmount4: number, coinbaseAmount5: number, coinbaseAmountDefault: number) => {
  const expectedStats = {
    coinbaseAmountBonus: types.uint(coinbaseAmountBonus),
    coinbaseAmount1: types.uint(coinbaseAmount1),
    coinbaseAmount2: types.uint(coinbaseAmount2),
    coinbaseAmount3: types.uint(coinbaseAmount3),
    coinbaseAmount4: types.uint(coinbaseAmount4),
    coinbaseAmount5: types.uint(coinbaseAmount5),
    coinbaseAmountDefault: types.uint(coinbaseAmountDefault),
  };
  const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(cityId).result.expectTuple();
  assertEquals(coinbaseInfo.amounts.expectSome().expectTuple(), expectedStats);
};

const testExpectedCoinbaseThresholds = (ccd005CityData: any, cityId: number, coinbaseThreshold1: number, coinbaseThreshold2: number, coinbaseThreshold3: number, coinbaseThreshold4: number, coinbaseThreshold5: number) => {
  const expectedStats = {
    coinbaseThreshold1: types.uint(coinbaseThreshold1),
    coinbaseThreshold2: types.uint(coinbaseThreshold2),
    coinbaseThreshold3: types.uint(coinbaseThreshold3),
    coinbaseThreshold4: types.uint(coinbaseThreshold4),
    coinbaseThreshold5: types.uint(coinbaseThreshold5),
  };
  const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(cityId).result.expectTuple();
  assertEquals(coinbaseInfo.thresholds.expectSome().expectTuple(), expectedStats);
};

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd005-city-data: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act

    // assert
    ccd005CityData.isDaoOrExtension().result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Extension callback

Clarinet.test({
  name: "ccd005-city-data: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    const { receipts } = chain.mineBlock([ccd005CityData.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

// =============================
// 1. CITY ACTIVATION TESTS
// =============================

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-status() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    const { receipts } = chain.mineBlock([ccd005CityData.setCityActivationStatus(sender, miaCityId, true)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-status() fails if status is unchanged",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    let block = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(false);
    block = chain.mineBlock([ccd005CityData.setCityActivationStatus(sender, miaCityId, true)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-status() succeeds and changes city status",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const activated = 1;
    const delay = 1;
    const target = 1;
    const threshold = 1;

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(false);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(true); //.expectOk().expectSome().expectBool(true);
    testExpectedCityDetails(ccd005CityData, miaCityId, activated, delay, target, threshold);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-details() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    const { receipts } = chain.mineBlock([ccd005CityData.setCityActivationDetails(sender, miaCityId, 1, 1, 1, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-details() fails if city is unknown",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    let block = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    ccd005CityData.isCityActivated(10).result.expectBool(false);
    block = passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_005);

    // assert
    ccd005CityData.isCityActivated(10).result.expectBool(false);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-details() succeeds and changes city details",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(false);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(true); //.expectOk().expectSome().expectBool(true);
    testExpectedCityDetails(ccd005CityData, miaCityId, 1, 1, 1, 1);
  },
});

Clarinet.test({
  name: "ccd005-city-data: activate-city() fails to activate if signalled by same account",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);

    // there should be no signals yet
    ccd005CityData.getCityActivationSignals(nycCityId).result.expectUint(0);
    // city should not be activated
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    testExpectedCityDetails(ccd005CityData, nycCityId, 2, 2, 2, 2);

    let block = chain.mineBlock([ccd005CityData.activateCity(sender, 2, "memo 1")]);

    ccd005CityData.getCityActivationSignals(nycCityId).result.expectUint(1);
    // city should not be activated
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    // sender should have voted already
    ccd005CityData.getCityActivationVoter(2, sender.address).result.expectBool(true);
    // send second signal
    block = chain.mineBlock([ccd005CityData.activateCity(sender, 2, "memo 2")]);

    // assert
    ccd005CityData.getCityActivationSignals(nycCityId).result.expectUint(1);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    block.receipts[0].result.expectErr().expectUint(ErrCode.ERR_ALREADY_VOTED);
    testExpectedCityDetails(ccd005CityData, nycCityId, 2, 2, 2, 2);
  },
});

Clarinet.test({
  name: "ccd005-city-data: activate-city() succeeds if activated by two different voters",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const approver1 = accounts.get("wallet_1")!;
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    ccd005CityData.getCityActivationSignals(nycCityId).result.expectUint(0);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    testExpectedCityDetails(ccd005CityData, nycCityId, 2, 2, 2, 2);

    let block = chain.mineBlock([ccd005CityData.activateCity(sender, 2, "memo 1")]);

    ccd005CityData.getCityActivationSignals(nycCityId).result.expectUint(1);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);

    block = chain.mineBlock([ccd005CityData.activateCity(approver1, 2, "memo 2")]);

    // assert
    ccd005CityData.getCityActivationVoter(nycCityId, sender.address).result.expectBool(true);
    ccd005CityData.getCityActivationVoter(nycCityId, approver1.address).result.expectBool(true);
    ccd005CityData.getCityActivationSignals(nycCityId).result.expectUint(2);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(true);
    block.receipts[0].result.expectOk();
    testExpectedCityDetails(ccd005CityData, nycCityId, START_BLOCK_CCD005, 2, START_BLOCK_CCD005 + 2, 2);
  },
});

// =============================
// 2. CITY DATA COINBASE TESTS
// =============================

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-thresholds() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    const { receipts } = chain.mineBlock([ccd005CityData.setCityCoinbaseThresholds(sender, miaCityId, 2, 2, 2, 2, 2)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-thresholds() fails if threshold T(n) <= T(n-1)",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    // create city ids
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city activation details
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set city coinbase thresholds
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_008);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(false); //.expectOk().expectSome().expectBool(true);
    const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(miaCityId).result.expectTuple();
    coinbaseInfo.thresholds.expectNone();
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-thresholds() succeeds and sets thresholds for inactive city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(false);
    testExpectedCoinbaseThresholds(ccd005CityData, miaCityId, 6, 7, 8, 9, 10);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-thresholds() succeeds and sets thresholds for active city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(true);
    testExpectedCoinbaseThresholds(ccd005CityData, miaCityId, 6, 7, 8, 9, 10);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-amounts() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    const { receipts } = chain.mineBlock([ccd005CityData.setCityCoinbaseAmounts(sender, miaCityId, 2, 2, 2, 2, 2, 2, 2)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-amounts() fails if any amount is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_006);

    // assert
    const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(miaCityId).result.expectTuple();
    coinbaseInfo.amounts.expectNone();
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-amounts() succeeds if amounts increase",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);

    // assert
    testExpectedCoinbaseAmount(ccd005CityData, miaCityId, 10, 100, 1000, 10000, 100000, 1000000, 10000000);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-amounts() succeeds and sets amounts for active city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_007);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(true);
    testExpectedCoinbaseAmount(ccd005CityData, miaCityId, 10, 10, 10, 10, 10, 10, 10);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-amounts() succeeds and sets amounts for inactive city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_007);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(false); //.expectOk().expectSome().expectBool(true);
    testExpectedCoinbaseAmount(ccd005CityData, miaCityId, 10, 10, 10, 10, 10, 10, 10);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-bonus-period() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    const { receipts } = chain.mineBlock([ccd005CityData.setCityCoinbaseBonusPeriod(sender, miaCityId, 20)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-bonus-period() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    // assert
    receipts[3].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_INVALID_CITY);
    const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(miaCityId).result.expectTuple();
    coinbaseInfo.bonusPeriod.expectNone();
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-bonus-period() fails if period is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_017);
    // assert
    receipts[3].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_INVALID_BONUS_PERIOD);
    const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(miaCityId).result.expectTuple();
    coinbaseInfo.bonusPeriod.expectNone();
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-bonus-period() succeeds if period is greater than 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    // assert
    const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(miaCityId).result.expectTuple();
    coinbaseInfo.bonusPeriod.expectSome().expectUint(20);
  },
});

// =============================
// 3. CITY TREASURY TESTS
// =============================

Clarinet.test({
  name: "ccd005-city-data: get-city-treasury-*() succeeds and returns none if city is unknown",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);

    // assert
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(0);
    ccd005CityData.getCityTreasuryId(miaCityId, miaTreasuryName).result.expectNone();
    ccd005CityData.getCityTreasuryName(miaCityId, miaTreasuryId).result.expectNone();
    ccd005CityData.getCityTreasuryAddress(miaCityId, miaTreasuryId).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd005-city-data: get-city-treasury-*() succeeds and returns none if city is known and treasury undefined",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // assert
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(0);
    ccd005CityData.getCityTreasuryId(miaCityId, miaTreasuryName).result.expectNone();
    ccd005CityData.getCityTreasuryName(miaCityId, miaTreasuryId).result.expectNone();
    ccd005CityData.getCityTreasuryAddress(miaCityId, miaTreasuryId).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd005-city-data: add-city-treasury() succeeds and creates treasury data if city is known",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_011);

    // assert
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    ccd005CityData.getCityTreasuryId(miaCityId, miaTreasuryName).result.expectSome().expectUint(1);
    ccd005CityData.getCityTreasuryName(miaCityId, miaTreasuryId).result.expectSome().expectAscii(miaTreasuryName);
    ccd005CityData
      .getCityTreasuryAddress(miaCityId, miaTreasuryId)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTreasuryName);
  },
});

Clarinet.test({
  name: "ccd005-city-data: add-city-treasury() succeeds and returns the correct nonces for the treasury",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add three treasuries to mia city
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_014);

    // assert
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(3);
    ccd005CityData.getCityTreasuryId(miaCityId, "mia-test-1").result.expectSome().expectUint(1);
    ccd005CityData.getCityTreasuryId(miaCityId, "mia-test-2").result.expectSome().expectUint(2);
    ccd005CityData.getCityTreasuryId(miaCityId, "mia-test-3").result.expectSome().expectUint(3);
    ccd005CityData.getCityTreasuryId(miaCityId, "mia-test-4").result.expectNone();
    ccd005CityData.getCityTreasuryName(miaCityId, 1).result.expectSome().expectAscii("mia-test-1");
    ccd005CityData.getCityTreasuryName(miaCityId, 2).result.expectSome().expectAscii("mia-test-2");
    ccd005CityData.getCityTreasuryName(miaCityId, 3).result.expectSome().expectAscii("mia-test-3");
    ccd005CityData.getCityTreasuryName(miaCityId, 4).result.expectNone();
    ccd005CityData
      .getCityTreasuryAddress(miaCityId, 1)
      .result.expectSome()
      .expectPrincipal(sender.address + ".mia-treasury-1");
    ccd005CityData
      .getCityTreasuryAddress(miaCityId, 2)
      .result.expectSome()
      .expectPrincipal(sender.address + ".mia-treasury-2");
    ccd005CityData
      .getCityTreasuryAddress(miaCityId, 3)
      .result.expectSome()
      .expectPrincipal(sender.address + ".mia-treasury-3");
    ccd005CityData.getCityTreasuryAddress(miaCityId, 4).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd005-city-data: add-city-treasury() fails when creating two treasuries for the same city with the same name",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add treasury to mia city
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_011);
    // passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_012);

    // assert
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    ccd005CityData.getCityTreasuryId(miaCityId, miaTreasuryName).result.expectSome().expectUint(1);
    ccd005CityData.getCityTreasuryName(miaCityId, miaTreasuryId).result.expectSome().expectAscii(miaTreasuryName);
    ccd005CityData
      .getCityTreasuryAddress(miaCityId, miaTreasuryId)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTreasuryName);

    // add treasury to mia city
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_013);

    // assert

    // nonce would not be incremented if treasury was not created
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    ccd005CityData.getCityTreasuryId(miaCityId, miaTreasuryName).result.expectSome().expectUint(1);
    ccd005CityData.getCityTreasuryName(miaCityId, miaTreasuryId).result.expectSome().expectAscii(miaTreasuryName);
    ccd005CityData
      .getCityTreasuryAddress(miaCityId, miaTreasuryId)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTreasuryName);

    // contradict above assertions to show expected behaviour - can't create two treasuries with same same and address
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
  },
});

/* 
TODO MJC: Cleanup once reviewed..
JS: removing code below as I think it contradicts the goal above
- TEST_CCD005_CITY_DATA_012 adds: u1 .mia-treasury "mia-treasury"
- TEST_CCD005_CITY_DATA_013 adds: u2 .mia-treasury "mia-treasury"
- this pattern would be invalidated by the previous test
- treasuries between cities are independent, so the same contract could be set for both cities if there was a need
- each city will be expected to have a "mining" and "stacking" treasury for the protocol to use

Clarinet.test({
  name: "ccd005-city-data: add-city-treasury() cannot creates two treasuries for different cities with the same name and address",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD005_CITY_DATA_001
    );
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add treasury to mia city
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_012);

    // assert
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    ccd005CityData
      .getCityTreasuryId(miaCityId, miaTreasuryName)
      .result.expectSome()
      .expectUint(1);
    ccd005CityData
      .getCityTreasuryName(miaCityId, miaTreasuryId)
      .result.expectSome()
      .expectAscii(miaTreasuryName);
    ccd005CityData
      .getCityTreasuryAddress(miaCityId, miaTreasuryId)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTreasuryName);

    // add treasury to mia city
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_013);

    // assert
    ccd005CityData.getCityTreasuryNonce(nycCityId).result.expectUint(1);
    ccd005CityData
      .getCityTreasuryId(nycCityId, miaTreasuryName)
      .result.expectSome()
      .expectUint(1);
    ccd005CityData
      .getCityTreasuryName(nycCityId, miaTreasuryId)
      .result.expectSome()
      .expectAscii(miaTreasuryName);
    ccd005CityData
      .getCityTreasuryAddress(nycCityId, miaTreasuryId)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTreasuryName);

    // contradict above assertions to show expected behaviour - can't create two treasuries with same same and address
    ccd005CityData.getCityTreasuryNonce(nycCityId).result.expectUint(0);
    ccd005CityData
      .getCityTreasuryId(nycCityId, miaTreasuryName)
      .result.expectNone();
    ccd005CityData
      .getCityTreasuryName(nycCityId, miaTreasuryId)
      .result.expectNone();
    ccd005CityData
      .getCityTreasuryAddress(nycCityId, miaTreasuryId)
      .result.expectNone();
  },
});
**/
// =============================
// 4. CITY TOKEN CONTRACTS TESTS
// =============================

Clarinet.test({
  name: "ccd005-city-data: add-city-token-contract() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    const { receipts } = chain.mineBlock([ccd005CityData.addCityTokenContract(sender, miaCityId, sender.address + "." + miaTokenContract1Address)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: get-city-token-contract-*() succeeds and returns none if city is known and token contracts undefined",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // assert
    ccd005CityData.getCityTokenContractNonce(miaCityId).result.expectUint(0);
    ccd005CityData.getCityTokenContractId(miaCityId, sender.address + "." + miaTokenContract1Address).result.expectNone();
    ccd005CityData.getCityTokenContractAddress(miaCityId, 1).result.expectNone();
    ccd005CityData.getActiveCityTokenContract(miaCityId).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd005-city-data: add-city-token-contract() succeeds and adds three token contracts to an active city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_015);

    // assert
    ccd005CityData.getCityTokenContractNonce(miaCityId).result.expectUint(3);
    ccd005CityData.getActiveCityTokenContract(miaCityId).result.expectNone();

    ccd005CityData
      .getCityTokenContractId(miaCityId, sender.address + "." + miaTokenContract1Address)
      .result.expectSome()
      .expectUint(1);
    ccd005CityData
      .getCityTokenContractAddress(miaCityId, 1)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTokenContract1Address);

    ccd005CityData
      .getCityTokenContractId(miaCityId, sender.address + "." + miaTokenContract2Address)
      .result.expectSome()
      .expectUint(2);
    ccd005CityData
      .getCityTokenContractAddress(miaCityId, 2)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTokenContract2Address);

    ccd005CityData
      .getCityTokenContractId(miaCityId, sender.address + "." + miaTokenContract3Address)
      .result.expectSome()
      .expectUint(3);
    ccd005CityData
      .getCityTokenContractAddress(miaCityId, 3)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTokenContract3Address);
  },
});

Clarinet.test({
  name: "ccd005-city-data: add-city-token-contract() fails when activating a token contract for an inactive city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_015);

    // assert
    ccd005CityData.getCityTokenContractNonce(miaCityId).result.expectUint(3);
    ccd005CityData.getActiveCityTokenContract(miaCityId).result.expectNone();

    ccd005CityData
      .getCityTokenContractId(miaCityId, sender.address + "." + miaTokenContract1Address)
      .result.expectSome()
      .expectUint(1);
    ccd005CityData
      .getCityTokenContractAddress(miaCityId, 1)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTokenContract1Address);

    ccd005CityData
      .getCityTokenContractId(miaCityId, sender.address + "." + miaTokenContract2Address)
      .result.expectSome()
      .expectUint(2);
    ccd005CityData
      .getCityTokenContractAddress(miaCityId, 2)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTokenContract2Address);

    ccd005CityData
      .getCityTokenContractId(miaCityId, sender.address + "." + miaTokenContract3Address)
      .result.expectSome()
      .expectUint(3);
    ccd005CityData
      .getCityTokenContractAddress(miaCityId, 3)
      .result.expectSome()
      .expectPrincipal(sender.address + "." + miaTokenContract3Address);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-active-city-token-contract() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_015);
    const { receipts } = chain.mineBlock([ccd005CityData.setActiveCityTokenContract(sender, miaCityId, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-active-city-token-contract() succeeds and sets active contract for inactive city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_015);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_016);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(false);
    const expectedStats = {
      tokenId: types.uint(3),
      tokenAddress: sender.address + "." + miaTokenContract3Address,
    };
    assertEquals(ccd005CityData.getActiveCityTokenContract(miaCityId).result.expectSome().expectTuple(), expectedStats);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-active-city-token-contract() succeeds and sets active contract for active city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_015);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_016);

    // assert
    ccd005CityData.isCityActivated(miaCityId).result.expectBool(true);
    const expectedStats = {
      tokenId: types.uint(3),
      tokenAddress: sender.address + "." + miaTokenContract3Address,
    };
    assertEquals(ccd005CityData.getActiveCityTokenContract(miaCityId).result.expectSome().expectTuple(), expectedStats);
  },
});
