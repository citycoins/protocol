/**
 * Test class is structured as follows
 * 0. AUTHORIZATION CHECKS
 * 1. CITY ACTIVATION TESTS
 *    - set-city-activation-status
 *    - set-city-activation-details
 *    - activate-city
 * 2. CITY DATA TESTS
 *    - set-city-coinbase-thresholds
 *    - set-city-coinbase-amounts
 * 3. CITY TREASURY TESTS
 *    - add-city-treasury
 *    - add-city-treasury
 * 4. CITY TOKEN CONTRACTS TESTS
 *    - add-city-token-contract
 *    - set-active-city-token-contract
 */
import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import {
  constructAndPassProposal,
  passProposal,
  PROPOSALS,
} from "../../utils/common.ts";
import { CCD005CityData } from "../../models/extensions/ccd005-city-data.model.ts";
import { types } from "../../utils/deps.ts";

// HELPER FUNCTIONS
const testExpectedCityDetails = (
  ccd005CityData: any,
  cityId: number,
  activated: number,
  delay: number,
  target: number,
  threshold: number
) => {
  const expectedStats = {
    activated: types.uint(activated),
    delay: types.uint(delay),
    target: types.uint(target),
    threshold: types.uint(threshold),
  };
  assertEquals(
    ccd005CityData
      .getCityActivationDetails(cityId)
      .result.expectSome()
      .expectTuple(),
    expectedStats
  );
};

const testExpectedCoinbaseAmount = (
  ccd005CityData: any,
  cityId: number,
  coinbaseAmountBonus: number,
  coinbaseAmount1: number,
  coinbaseAmount2: number,
  coinbaseAmount3: number,
  coinbaseAmount4: number,
  coinbaseAmount5: number,
  coinbaseAmountDefault: number,
) => {
  const expectedStats = {
    coinbaseAmountBonus: types.uint(coinbaseAmountBonus),
    coinbaseAmount1: types.uint(coinbaseAmount1),
    coinbaseAmount2: types.uint(coinbaseAmount2),
    coinbaseAmount3: types.uint(coinbaseAmount3),
    coinbaseAmount4: types.uint(coinbaseAmount4),
    coinbaseAmount5: types.uint(coinbaseAmount5),
    coinbaseAmountDefault: types.uint(coinbaseAmountDefault),
  };
  assertEquals(
    ccd005CityData
      .getCityCoinbaseAmounts(cityId)
      .result.expectSome()
      .expectTuple(),
    expectedStats
  );
};

const testExpectedCoinbaseThresholds = (
  ccd005CityData: any,
  cityId: number,
  coinbaseThreshold1: number,
  coinbaseThreshold2: number,
  coinbaseThreshold3: number,
  coinbaseThreshold4: number,
  coinbaseThreshold5: number,
) => {
  const expectedStats = {
    coinbaseThreshold1: types.uint(coinbaseThreshold1),
    coinbaseThreshold2: types.uint(coinbaseThreshold2),
    coinbaseThreshold3: types.uint(coinbaseThreshold3),
    coinbaseThreshold4: types.uint(coinbaseThreshold4),
    coinbaseThreshold5: types.uint(coinbaseThreshold5),
  };
  assertEquals(
    ccd005CityData
      .getCityCoinbaseThresholds(cityId)
      .result.expectSome()
      .expectTuple(),
    expectedStats
  );
};

// 0. AUTHORIZATION CHECKS

Clarinet.test({
  name: "ccd005-city-data: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act

    // assert
    ccd005CityData
      .isDaoOrExtension()
      .result.expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

// 1. CITY ACTIVATION TESTS

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-details() can't be accessed directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    const { receipts } = chain.mineBlock([
      ccd005CityData.setCityActivationDetails(sender, 1, 1, 1, 1, 1),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-status() can't be accessed directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    const { receipts } = chain.mineBlock([
      ccd005CityData.setCityActivationStatus(sender, 1, true),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-status() fails if status is unchanged",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    let block = constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD005_CITY_DATA_001
    );
    ccd005CityData.isCityActivated(1).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    block = chain.mineBlock([
      ccd005CityData.setCityActivationStatus(sender, 1, true),
    ]);

    // assert
    block.receipts[0].result
      .expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-status() successfully changes city status",
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
    ccd005CityData.isCityActivated(1).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // assert
    ccd005CityData.isCityActivated(1).result.expectBool(true); //.expectOk().expectSome().expectBool(true);
    testExpectedCityDetails(ccd005CityData, 1, 1, 1, 1, 1);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-details() fails if city is unknown",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    let block = constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD005_CITY_DATA_001
    );
    ccd005CityData.isCityActivated(10).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    block = passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_005);

    // assert
    ccd005CityData.isCityActivated(10).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-details() successfully changes city details",
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
    ccd005CityData.isCityActivated(1).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // assert
    ccd005CityData.isCityActivated(1).result.expectBool(true); //.expectOk().expectSome().expectBool(true);
    testExpectedCityDetails(ccd005CityData, 1, 1, 1, 1, 1);
  },
});

Clarinet.test({
  name: "ccd005-city-data: activate-city() fails to activate if signalled by same account",
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
    ccd005CityData.getCityActivationSignals(2).result.expectUint(0);
    ccd005CityData.isCityActivated(2).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    testExpectedCityDetails(ccd005CityData, 2, 2, 2, 2, 2);

    let block = chain.mineBlock([
      ccd005CityData.activateCity(sender, 2, "memo 1"),
    ]);

    ccd005CityData.getCityActivationSignals(2).result.expectUint(1);
    ccd005CityData.isCityActivated(2).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    ccd005CityData
      .getCityActivationVoter(2, sender.address)
      .result.expectBool(true);
    ccd005CityData.isCityActivated(2).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    block = chain.mineBlock([ccd005CityData.activateCity(sender, 2, "memo 2")]);

    // assert
    ccd005CityData.getCityActivationSignals(2).result.expectUint(2);
    ccd005CityData.isCityActivated(2).result.expectBool(true); //.expectOk().expectSome().expectBool(false);
    console.log("block", block);
    block.receipts[1].result.expectOk();
    testExpectedCityDetails(ccd005CityData, 2, 2, 2, 2, 2);
  },
});

Clarinet.test({
  name: "ccd005-city-data: activate-city() successfully activated by two different voters",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const approver1 = accounts.get("wallet_1")!;
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
    ccd005CityData.getCityActivationSignals(2).result.expectUint(0);
    ccd005CityData.isCityActivated(2).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    testExpectedCityDetails(ccd005CityData, 2, 2, 2, 2, 2);

    let block = chain.mineBlock([
      ccd005CityData.activateCity(sender, 2, "memo 1"),
    ]);

    ccd005CityData.getCityActivationSignals(2).result.expectUint(1);
    ccd005CityData.isCityActivated(2).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    ccd005CityData.isCityActivated(2).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
   
    block = chain.mineBlock([ccd005CityData.activateCity(approver1, 2, "memo 2")]);

    // assert
    //ccd005CityData
    //  .getCityActivationVoter(2, sender.address)
    //  .result.expectBool(true);
    //ccd005CityData
    //  .getCityActivationVoter(2, approver1.address)
    //  .result.expectBool(true);
    ccd005CityData.getCityActivationSignals(2).result.expectUint(2);
    ccd005CityData.isCityActivated(2).result.expectBool(true); //.expectOk().expectSome().expectBool(false);
    //console.log("block", block);
    block.receipts[0].result.expectOk();
    testExpectedCityDetails(ccd005CityData, 2, 5, 2, 7, 2);
  },
});

// 2. CITY DATA TESTS

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-thresholds() can't be accessed directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    const { receipts } = chain.mineBlock([
      ccd005CityData.setCityCoinbaseThresholds(sender, 1, 2, 2, 2, 2, 2),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-amounts() can't be accessed directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    const { receipts } = chain.mineBlock([
      ccd005CityData.setCityCoinbaseAmounts(sender, 1, 2, 2, 2, 2, 2, 2, 2),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-amounts() fails if any amount is 0",
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
    const block = passProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD005_CITY_DATA_006
    );

    // assert
    ccd005CityData.getCityCoinbaseAmounts(1).result.expectNone(); //.expectOk().expectSome().expectBool(false);
    //console.log(block);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-thresholds() fails if any threshold is 0",
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
    const block = passProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD005_CITY_DATA_009
    );

    // assert
    ccd005CityData.getCityCoinbaseThresholds(1).result.expectNone(); //.expectOk().expectSome().expectBool(false);
    //console.log(block);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-amounts() successfully sets amounts",
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
    const block = passProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD005_CITY_DATA_007
    );

    // assert
    ccd005CityData.isCityActivated(1).result.expectBool(false); //.expectOk().expectSome().expectBool(true);
    testExpectedCoinbaseAmount(ccd005CityData, 1, 10, 10, 10, 10, 10, 10, 10);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-thresholds() fails if threshold T(n) <= T(n-1)",
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
    const block = passProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD005_CITY_DATA_008
    );

    // assert
    ccd005CityData.isCityActivated(1).result.expectBool(false); //.expectOk().expectSome().expectBool(true);
    ccd005CityData.getCityCoinbaseThresholds(1).result.expectNone(); //.expectOk().expectSome().expectBool(false);
  },
});

Clarinet.test({
  name: "ccd005-city-data: set-city-coinbase-thresholds() successfully sets thresholds",
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
    const block = passProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD005_CITY_DATA_010
    );

    // assert
    testExpectedCoinbaseThresholds(ccd005CityData, 1, 6, 7, 8, 9, 10);
  },
});
