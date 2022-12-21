/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. set-pool-operator / set-reward-cycle-length
 * 2. stack
 * 3. send-stacking-reward
 * 4. claim-stacking-reward
 * 5. set-reward-cycle-length
 */
import { types, Account, assertEquals, Clarinet, Chain } from "../../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS, EXTENSIONS } from "../../../utils/common.ts";
import { CCD007CityStacking } from "../../../models/extensions/ccd007-city-stacking.model.ts";
import { CCD002Treasury } from "../../../models/extensions/ccd002-treasury.model.ts";
import { CCEXTGovernanceToken } from "../../../models/external/test-ccext-governance-token.model.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const lockPeriod = 1;
const rewardCycleLength = 2100;
const miaCityName = "mia";
const miaTreasuryName = "ccd002-treasury-mia-stacking";
const miaCityId = 1;
const nycCityId = 2;

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails with ERR_TRANSFER_FAILED if the token contract is unknown to the treasury",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const user1 = accounts.get("wallet_1")!;
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, 500, lockPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_TRANSFER_FAILED);
    gt.getBalance(user1.address).result.expectOk().expectUint(1000);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: stack() succeeds and transfers mia tokens if the token contract is known to the treasury",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const user1 = accounts.get("wallet_1")!;
    const amountStacked = 500;
    const currentCycle = 0;
    const targetCycle = 1;
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // 010 adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);
    gt.getBalance(user1.address).result.expectOk().expectUint(1000);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, amountStacked, lockPeriod)]);

    // assert
    block.receipts[0].result.expectOk().expectBool(true);
    gt.getBalance(user1.address).result.expectOk().expectUint(amountStacked);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(amountStacked);
    //console.log(block.receipts[0].events[2].contract_event.value)
    const expected = `{action: "stacking", amountStacked: ${types.uint(amountStacked)}, cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, currentCycle: ${types.uint(currentCycle)}, firstCycle: ${types.uint(1)}, lastCycle: ${types.uint(targetCycle + lockPeriod - 1)}, lockPeriod: ${types.uint(lockPeriod)}, userId: ${types.uint(1)}}`;
    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd007-city-stacking`, expected);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() fails with ERR_NOTHING_TO_CLAIM if there is nothing to claim",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    const amountStacked = 500;

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // 010 adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, amountStacked, lockPeriod), ccd007CityStacking.claimStackingReward(user1, miaCityName, 2)]);

    // assert
    ccd007CityStacking.getStackingReward(miaCityId, 1, 1).result.expectNone();
    block.receipts[1].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() fails if reward cycle is incomplete",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const operator = accounts.get("wallet_2")!;
    const amountStacked = 500;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);

    // act

    // get or create user ID
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    // get or create city IDs
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set city activation status
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // set stacking pool operator
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    // set reward cycle length to 100 blocks
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    // add mia stacking treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);

    // JS: stacking happens in the *next* reward cycle, and payouts happen
    // after the cycle is complete.

    // stack during cycle 0, which starts in cycle 1
    const block0 = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, amountStacked, lockPeriod)]);
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(true);

    // progress to the next reward cycle
    // chain.mineEmptyBlock(rewardCycleLength + 10);

    // simulate pool operator sending stacking rewards for cycle 1
    // const block1 = chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, miaCityName, 1, 150000)]);

    // attempt to claim reward for cycle 1
    const block2 = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, miaCityName, 1)]);

    //console.log(`block0:\n${JSON.stringify(block0, null, 2)}`);
    //console.log(`block1:\n${JSON.stringify(block1, null, 2)}`);
    //console.log(`block2:\n${JSON.stringify(block2, null, 2)}`);

    // assert
    // confirm reward cycle 0 is active
    ccd007CityStacking.getRewardCycle(miaCityId, block2.height).result.expectSome().expectUint(0);
    block0.receipts[0].result.expectOk().expectBool(true);
    //block1.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
    // confirm nothing stacked in cycle 0
    let expected: any = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 0, 1).result.expectTuple(), expected);
    // confirm stacked and return amounts in cycle 1
    expected = {
      claimable: types.uint(amountStacked),
      stacked: types.uint(amountStacked),
    };
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() fails if stacking payout is incomplete",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const amountStacked = 500;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);

    // act

    // get or create user ID
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    // get or create city IDs
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set city activation status
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // set stacking pool operator
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    // set reward cycle length to 100 blocks
    //passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    // add mia stacking treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);

    // stack during cycle 0, which starts in cycle 1
    const block0 = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, amountStacked, lockPeriod)]);
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(true);

    // progress to the next reward cycle
    chain.mineEmptyBlock(rewardCycleLength + 10);

    // simulate pool operator sending stacking rewards for cycle 1
    // const block1 = chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, miaCityName, 1, 150000)]);

    // attempt to claim reward for cycle 1
    const block2 = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, miaCityName, 1)]);

    // assert

    // confirm reward cycle 1 is active
    ccd007CityStacking.getRewardCycle(miaCityId, block2.height).result.expectSome().expectUint(1);
    block0.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);

    //console.log(`block0:\n${JSON.stringify(block0, null, 2)}`);
    //console.log(`block2:\n${JSON.stringify(block2, null, 2)}`);

    // confirm nothing stacked in cycle 0 for the user
    let expected: any = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 0, 1).result.expectTuple(), expected);
    // confirm stacked and return amounts in cycle 1 for the user
    expected = {
      claimable: types.uint(amountStacked),
      stacked: types.uint(amountStacked),
    };
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 1, 1).result.expectTuple(), expected);
    /**
     * TODO MJC: Expecting the reward to match the operators reward for cycle 0 ?
     * JS: The stacking payout (paid by the pool operator) is for the total amount
     * stacked in the city treasury. Once that reward is paid, users can claim their
     * portion based on how much they stacked against the total.
     *
     * Formula for reference from the contract:
     * (payout * userStacked) / totalStacked
     */
    // confirm reward amount is not set in overall cycle 1 data
    expected = {
      reward: types.none(),
      total: types.uint(amountStacked),
    };
    assertEquals(ccd007CityStacking.getStackingStatsAtCycle(miaCityId, 1).result.expectTuple(), expected);
    ccd007CityStacking.getStackingReward(miaCityId, 1, 0).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() succeeds if cycle has passed and stacking payout is complete",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const operator = accounts.get("wallet_2")!;
    const amountStacked = 500;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-stacking");

    // act

    // get or create user ID
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    // get or create city IDs
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set city activation status
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // set stacking pool operator
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    // set reward cycle length to 100 blocks
    //passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    // add mia stacking treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);

    // mid point check of the stx/mia token balances
    gt.getBalance(user1.address).result.expectOk().expectUint(1000);
    ccd002Treasury.getBalanceStx().result.expectUint(0);

    // stack during cycle 0, which starts in cycle 1
    const block0 = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, amountStacked, lockPeriod)]);
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(true);

    gt.getBalance(user1.address).result.expectOk().expectUint(500);

    // simulate pool operator sending stacking rewards for cycle 1
    // after progressing past cycle 1
    chain.mineEmptyBlock(rewardCycleLength * 2 + 10);
    const block1 = chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, miaCityName, 1, 150000)]);

    // mid point check of the stx/mia token balances
    const expected1 = {
      claimable: types.uint(500),
      stacked: types.uint(500),
    };
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 1, 1).result.expectTuple(), expected1);
    
    // confirm stacking reward is correct for the user and attempt to claim
    ccd007CityStacking.getStackingReward(miaCityId, 1, 1).result.expectSome().expectUint(150000);
    ccd002Treasury.getBalanceStx().result.expectUint(150000);
    const block2 = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, miaCityName, 1)]);

    // assert

    // confirm reward cycle 2 is active
    ccd007CityStacking.getRewardCycle(miaCityId, block2.height).result.expectSome().expectUint(2);
    block0.receipts[0].result.expectOk().expectBool(true);
    block1.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectOk().expectBool(true);

    //console.log(`block0:\n${JSON.stringify(block0, null, 2)}`);
    //console.log(`block2:\n${JSON.stringify(block2, null, 2)}`);

    // confirm nothing stacked in cycle 0 for the user
    let expected: any = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 1, 1).result.expectTuple(), expected);
    // confirm stacked and return amounts cleared in cycle 1 for the user
    expected = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 1, 1).result.expectTuple(), expected);
    /**
     * TODO MJC: Expecting the reward to match the operators reward for cycle 0 ?
     *
     * JS: The stacking payout (paid by the pool operator) is for the total amount
     * stacked in the city treasury. Once that reward is paid, users can claim their
     * portion based on how much they stacked against the total.
     *
     * Formula for reference from the contract:
     * (payout * userStacked) / totalStacked
     */
    // confirm reward amount is set in overall cycle 1 data
    expected = {
      reward: types.some(types.uint(150000)),
      total: types.uint(amountStacked),
    };
    assertEquals(ccd007CityStacking.getStackingStatsAtCycle(miaCityId, 1).result.expectTuple(), expected);

    // end point check of the stx/mia token balances
    ccd002Treasury.getBalanceStx().result.expectUint(0);
    gt.getBalance(user1.address).result.expectOk().expectUint(1000);

  },
});

Clarinet.test({
  name: "ccd007-city-stacking: get-first-block-in-reward-cycle() returns none if city activation details are not set",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);

    // act

    // assert
    ccd007CityStacking.getFirstBlockInRewardCycle(1, 0).result.expectNone();

  },
});

Clarinet.test({
  name: "ccd007-city-stacking: get-first-block-in-reward-cycle() returns correct block for mia with activation=1, for first few cycles",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);

    // act
    // get or create user ID
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    // get or create city IDs
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);

    // assert
    chain.mineEmptyBlock(rewardCycleLength * 2 + 10);
    ccd007CityStacking.getFirstBlockInRewardCycle(miaCityId, 0).result.expectSome().expectUint(1);
    ccd007CityStacking.getFirstBlockInRewardCycle(miaCityId, 1).result.expectSome().expectUint(2101);
    ccd007CityStacking.getFirstBlockInRewardCycle(miaCityId, 2).result.expectSome().expectUint(4201);
    ccd007CityStacking.getFirstBlockInRewardCycle(miaCityId, 3).result.expectSome().expectUint(6301);

  },
});

Clarinet.test({
  name: "ccd007-city-stacking: get-first-block-in-reward-cycle() returns correct block for nyc with activation=2, for first few cycles",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(nycCityId, 1).result.expectBool(false);

    // act
    // get or create user ID
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    // get or create city IDs
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);

    // assert
    //chain.mineEmptyBlock(rewardCycleLength * 2 + 10);
    ccd007CityStacking.getFirstBlockInRewardCycle(nycCityId, 0).result.expectSome().expectUint(2);
    ccd007CityStacking.getFirstBlockInRewardCycle(nycCityId, 1).result.expectSome().expectUint(2102);
    ccd007CityStacking.getFirstBlockInRewardCycle(nycCityId, 2).result.expectSome().expectUint(4202);

  },
});

