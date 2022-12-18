/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. STACKING
 *    - stack
 *    - set-pool-operator
 * 2. CLAIMING
 *    - claim-stacking-reward
 *    - send-stacking-reward
 *    - claim-stacking-reward
 * 3. REWARDING
 *    - set-reward-cycle-length
 */
import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-city-stacking.model.ts";
import { CCD002Treasury } from "../../models/extensions/ccd002-treasury.model.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const lockingPeriod = 32;
const miaCityId = 1;
const miaCityName = "mia";
const miaTreasuryId = 1;
const miaMiningTreasuryName = "mining";
const miaTreasuryName = "ccd002-treasury-mia-mining";

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd007-city-stacking: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act

    // assert
    ccd007CityStacking.isDaoOrExtension().result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Extension callback

Clarinet.test({
  name: "ccd007-city-stacking: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    const { receipts } = chain.mineBlock([ccd007CityStacking.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

// =============================
// 1. STACKING
// =============================

Clarinet.test({
  name: "ccd007-city-stacking: set-pool-operator() fails if called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    const block = chain.mineBlock([ccd007CityStacking.setPoolOperator(sender, sender.address)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: set-pool-operator() successfully sets a new pool operator",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.getPoolOperator().result.expectSome().expectPrincipal('SPFP0018FJFD82X3KCKZRGJQZWRCV9793QTGE87M');

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);

    // assert
    receipts[3].result.expectOk().expectUint(3);
    ccd007CityStacking.getPoolOperator().result.expectSome().expectPrincipal('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: set-reward-cycle-length() fails if called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    const block = chain.mineBlock([ccd007CityStacking.setRewardCycleLength(sender, 200)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: set-reward-cycle-length() successfully sets a reward cycle length",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.getPoolOperator().result.expectSome().expectPrincipal('SPFP0018FJFD82X3KCKZRGJQZWRCV9793QTGE87M');

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);

    // assert
    receipts[3].result.expectOk().expectUint(3);
    ccd007CityStacking.getPoolOperator().result.expectSome().expectPrincipal('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 200, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_CITY_ID_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if city is not activated",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 200, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_CITY_NOT_ACTIVATED);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if lock period is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 5000, 0)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_STACKING_PARAMS);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if lock period is more than max",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 5000, 33)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_STACKING_PARAMS);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if amount is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 0, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_STACKING_PARAMS);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if treasury is not set",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 5000, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_CITY_TREASURY_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if stacking is unavailable",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 5000, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_STACKING_NOT_AVAILABLE);
  }, 
});

// =============================
// 2. CLAIMING
// =============================

// =============================
// 3. REWARDING
// =============================

