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
    const expectedStats = {
      activated: types.uint(1),
      delay: types.uint(1),
      target: types.uint(1),
      threshold: types.uint(1),
    };
    assertEquals(
      ccd005CityData
        .getCityActivationDetails(1)
        .result.expectSome()
        .expectTuple(),
      expectedStats
    );
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
    const expectedStats = {
      activated: types.uint(1),
      delay: types.uint(1),
      target: types.uint(1),
      threshold: types.uint(1),
    };
    assertEquals(
      ccd005CityData
        .getCityActivationDetails(1)
        .result.expectSome()
        .expectTuple(),
      expectedStats
    );
  },
});

Clarinet.test({
  name: "ccd005-city-data: activate-city() fails to activate if signalled by same account",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;

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

    // there should be no signals yet
    ccd005CityData.getCityActivationSignals(2).result.expectUint(0);
    // city should not be activated
    ccd005CityData.isCityActivated(2).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    // send first signal
    chain.mineBlock([ccd005CityData.activateCity(sender, 2, "memo 1")]);
    // signals should increase by one
    ccd005CityData.getCityActivationSignals(2).result.expectUint(1);
    // city should not be activated
    ccd005CityData.isCityActivated(2).result.expectBool(false); //.expectOk().expectSome().expectBool(false);
    // sender should have voted already
    ccd005CityData
      .getCityActivationVoter(2, sender.address)
      .result.expectBool(true);
    // send second signal
    let block = chain.mineBlock([
      ccd005CityData.activateCity(wallet_1, 2, "memo 2"),
    ]);

    // assert

    // verify city details are set
    const delay = 2; // matches test-ccd005-city-data-001
    const threshold = 2; // matches test-ccd005-city-data-001
    const lastBlock = block.height - 1;
    const expectedStats = {
      activated: types.uint(lastBlock),
      delay: types.uint(delay),
      target: types.uint(lastBlock + delay),
      threshold: types.uint(threshold),
    };
    assertEquals(
      ccd005CityData
        .getCityActivationDetails(2)
        .result.expectSome()
        .expectTuple(),
      expectedStats
    );

    // signals should increase by one
    ccd005CityData.getCityActivationSignals(2).result.expectUint(2);
    // city should be activated
    ccd005CityData.isCityActivated(2).result.expectBool(true); //.expectOk().expectSome().expectBool(false);
    // console.log("block", block);
    // block.receipts[1].result.expectOk();
    // ccd005CityData.isCityActivated(2).result.expectBool(true) //.expectOk().expectSome().expectBool(false);
    //.expectErr().expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});
