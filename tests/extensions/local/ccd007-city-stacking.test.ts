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
const miaTreasuryName = "mia-treasury";
const miaCityId = 1;

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails to transfer mia tokens if the token contract is unknown to the treasury",
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
  name: "ccd007-city-stacking: stack() transfers mia tokens if the token contract is known to the treasury",
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
  name: "ccd007-city-stacking: claim-stacking-reward() prevents claims if there is nothing to claim",
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
    const block = chain.mineBlock([
      ccd007CityStacking.stack(user1, miaCityName, amountStacked, lockPeriod),
      ccd007CityStacking.claimStackingReward(user1, miaCityName, 2)
    ]);
    
    // assert
    ccd007CityStacking.getStackingReward(miaCityId, 1, 1).result.expectNone()
    block.receipts[1].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
  },
});

Clarinet.test({
  name: "ccd007-city-stacking: claim-stacking-reward() prevents claims if reward cycle is incomplete",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    const amountStacked = 500;
    const operator = accounts.get("wallet_2")!;

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
    const block1 = chain.mineBlock([
      ccd007CityStacking.stack(user1, miaCityName, amountStacked, lockPeriod),
    ]);
    chain.mineEmptyBlock(rewardCycleLength + 10);
    const block2 = chain.mineBlock([
      ccd007CityStacking.claimStackingReward(user1, miaCityName, 0),
      ccd007CityStacking.claimStackingReward(user1, miaCityName, 1)
    ]);
    chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, miaCityName, 0, 50000)]);
    chain.mineBlock([ccd007CityStacking.sendStackingReward(operator, miaCityName, 1, 150000)]);

    // assert
    block1.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
    ccd007CityStacking.getRewardCycle(miaCityId, block2.height).result.expectSome().expectUint(1)
    let expected: any = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 0, 1).result.expectTuple(), expected);
    expected = {
      claimable: types.uint(500),
      stacked: types.uint(500),
    };
    /**
     * TODO MJC: Expecting the reward to match the operators reward for cycle 0 ?
     */
    assertEquals(ccd007CityStacking.getStackerAtCycle(miaCityId, 1, 1).result.expectTuple(), expected);
    expected = {
      reward: types.uint(50000),
      total: types.uint(500),
    };
    assertEquals(ccd007CityStacking.getStackingStatsAtCycle(miaCityId, 1).result.expectTuple(), expected);
    ccd007CityStacking.getStackingReward(miaCityId, 1, 0).result.expectNone()
  },
});
