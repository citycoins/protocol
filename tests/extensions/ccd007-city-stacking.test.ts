/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. set-pool-operator / set-reward-cycle-length
 * 2. stack
 * 3. send-stacking-reward
 * 4. claim-stacking-reward
 * 5. set-reward-cycle-length
 */
import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-city-stacking.model.ts";
import { CCD002Treasury } from "../../models/extensions/ccd002-treasury.model.ts";
import { CCD003UserRegistry } from "../../models/extensions/ccd003-user-registry.model.ts";
import { types } from "../../utils/deps.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const lockingPeriod = 32;
const rewardCycleLength = 100;
const miaCityName = "mia";
const nycCityName = "nyc";
const miaCityId = 1;

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
// 1. set-pool-operator / set-reward-cycle-length
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
    ccd007CityStacking.getPoolOperator().result.expectSome().expectPrincipal("SPFP0018FJFD82X3KCKZRGJQZWRCV9793QTGE87M");

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);

    // assert
    receipts[3].result.expectOk().expectUint(3);
    ccd007CityStacking.getPoolOperator().result.expectSome().expectPrincipal("ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG");
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
    ccd007CityStacking.getPoolOperator().result.expectSome().expectPrincipal("SPFP0018FJFD82X3KCKZRGJQZWRCV9793QTGE87M");

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);

    // assert
    receipts[3].result.expectOk().expectUint(3);
    ccd007CityStacking.getRewardCycleLength().result.expectUint(rewardCycleLength);
  },
});

// =============================
// 2. stack
// =============================

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
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // sets city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // sets city activation status to true
    // passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add city treasury named "stacking"
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // 010 adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, 200, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_CITY_NOT_ACTIVATED);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if lock period is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // sets city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // sets city activation status to true
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add city treasury named "stacking"
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // 010 adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, 5000, 0)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_STACKING_PARAMS);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if lock period is more than max",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // sets city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // sets city activation status to true
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add city treasury named "stacking"
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // 010 adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, 5000, 33)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_STACKING_PARAMS);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if amount is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // sets city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // sets city activation status to true
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add city treasury named "stacking"
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // 010 adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, 0, lockingPeriod)]);

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
  name: "ccd007-city-stacking: stack() fails if asset is not on allow list",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 5000, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_ASSET_NOT_ALLOWED);
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
// 2. send-stacking-reward
// =============================

Clarinet.test({
  name: "ccd007-city-stacking: send-stacking-reward() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    const block = chain.mineBlock([ccd007CityStacking.sendStackingReward(sender, miaCityName, 2, 5000)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_CITY_ID_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: send-stacking-reward() fails if treasury is not set",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    const block = chain.mineBlock([ccd007CityStacking.sendStackingReward(sender, miaCityName, 2, 5000)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_CITY_TREASURY_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: send-stacking-reward() fails if stacking is unavailable",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.sendStackingReward(sender, miaCityName, 5000, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_STACKING_NOT_AVAILABLE);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: send-stacking-reward() fails if not called by pool operator",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    //const operator = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.sendStackingReward(sender, miaCityName, 5000, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: send-stacking-reward() fails if payout amount is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, miaCityName, 5000, 0)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_STACKING_PAYOUT);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: send-stacking-reward() fails if given payout cycle is earlier than current cycle",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    chain.mineEmptyBlock(rewardCycleLength);

    const block = chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, miaCityName, 1, 50000)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_REWARD_CYCLE_NOT_COMPLETE);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: send-stacking-reward() successfully sends funds to the mia treasury",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // could change this to rewardCycleLength * (targetCycle + 1) + 1
    chain.mineEmptyBlock(rewardCycleLength * 11 + 10);

    const block = chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, miaCityName, 10, 50000)]);

    // assert
    ccd002Treasury.getBalanceStx().result.expectUint(50000);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: send-stacking-reward() successfully sends funds to the nyc treasury",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_008);
    // could change this to rewardCycleLength * (targetCycle + 1) + 1
    chain.mineEmptyBlock(rewardCycleLength * 11 + 10);

    const block = chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, nycCityName, 10, 50000)]);

    // assert
    ccd002Treasury.getBalanceStx().result.expectUint(50000);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

// =============================
// 4. claim-stacking-reward
// =============================

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    const block = chain.mineBlock([ccd007CityStacking.claimStackingReward(sender, miaCityName, 1)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_CITY_ID_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: get-stacking-reward() returns correct default stacking data",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act

    // assert
    ccd007CityStacking.getStackingReward(miaCityId, 1, 1).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: get-stacker-at-cycle() returns correct default stacking data",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act

    // assert
    const expectedStats = {
      stacked: types.uint(0),
      claimable: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 1, 1).result.expectTuple(), expectedStats);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() fails if user is unknown",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    const block = chain.mineBlock([ccd007CityStacking.claimStackingReward(sender, miaCityName, 1)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_USER_ID_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() fails if stacking is unavailable",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.claimStackingReward(user, miaCityName, 1)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_STACKING_NOT_AVAILABLE);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() fails if stacking is unavailable",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    //const ccd003UserRegistry = new CCD003UserRegistry(chain, sender, "ccd003-user-registry");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.claimStackingReward(user, miaCityName, 1)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_STACKING_NOT_AVAILABLE);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() fails if user has nothing to claim",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    //const ccd003UserRegistry = new CCD003UserRegistry(chain, sender, "ccd003-user-registry");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.claimStackingReward(user, miaCityName, 1)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
  },
});
