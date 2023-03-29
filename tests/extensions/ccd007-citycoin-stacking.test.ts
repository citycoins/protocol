/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. stack
 * 2. claim-stacking-reward
 * 3. stacking-status
 */
import { Account, assertEquals, Clarinet, Chain, types } from "../../utils/deps.ts";
import { constructAndPassProposal, EXTENSIONS, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD002Treasury } from "../../models/extensions/ccd002-treasury.model.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCD011StackingPayouts } from "../../models/extensions/ccd011-stacking-payouts.model.ts";
import { CCEXTGovernanceToken } from "../../models/external/test-ccext-governance-token.model.ts";
// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const lockPeriod = 1;
const lockingPeriod = 32;
const miaCityName = "mia";
const miaCityId = 1;
const miaTreasuryName = "ccd002-treasury-mia-stacking";
const nycCityName = "nyc";
const nycCityId = 2;

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd007-citycoin-stacking: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");

    // act

    // assert
    ccd007CityStacking.isDaoOrExtension().result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: is-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");

    // act

    // assert
    ccd007CityStacking.isExtension().result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Extension callback

Clarinet.test({
  name: "ccd007-citycoin-stacking: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");

    // act
    const { receipts } = chain.mineBlock([ccd007CityStacking.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

// =============================
// 1. stack
// =============================

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");

    // act
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 200, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_CITY);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if city is not activated",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INACTIVE_CITY);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if lock period is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_PARAMS);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if lock period is more than max",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_PARAMS);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if amount is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_PARAMS);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if treasury is not set",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 5000, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_TREASURY);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if asset is not on allow list",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 5000, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if the token contract is unknown to the treasury",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const user1 = accounts.get("wallet_1")!;
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, 500, lockPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
    gt.getBalance(user1.address).result.expectOk().expectUint(1000);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() succeeds and stacks for 1 cycle",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const user1 = accounts.get("wallet_1")!;
    const amountStacked = 500;
    const targetCycle = 1;
    const cityId = 1;
    const userId = 1;
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    const expected = `{amountStacked: ${types.uint(amountStacked)}, cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, event: "stacking", firstCycle: ${types.uint(1)}, lastCycle: ${types.uint(targetCycle + lockPeriod - 1)}, lockPeriod: ${types.uint(lockPeriod)}, userId: ${types.uint(1)}}`;
    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd007-citycoin-stacking`, expected);
    assertEquals(ccd007CityStacking.getStacker(cityId, targetCycle, userId).result.expectTuple(), { claimable: types.uint(amountStacked), stacked: types.uint(amountStacked) });
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() succeeds and stacks for 16 cycles",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const user1 = accounts.get("wallet_1")!;
    const amountStacked = 500;
    const currentCycle = 0;
    const targetCycle = 1;
    const lockPeriod = 16;
    const cityId = 1;
    const userId = 1;
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    const expected = `{amountStacked: ${types.uint(amountStacked)}, cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, event: "stacking", firstCycle: ${types.uint(1)}, lastCycle: ${types.uint(targetCycle + lockPeriod - 1)}, lockPeriod: ${types.uint(lockPeriod)}, userId: ${types.uint(1)}}`;
    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd007-citycoin-stacking`, expected);
    for (let i = 0; i < lockPeriod; i++) {
      // console.log(`i: ${i}`);
      const stacker = ccd007CityStacking.getStacker(cityId, targetCycle + i, userId).result;
      assertEquals(stacker.expectTuple(), { claimable: types.uint(i === lockPeriod - 1 ? amountStacked : 0), stacked: types.uint(amountStacked) });
    }
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() succeeds and stacks for 32 cycles",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const user1 = accounts.get("wallet_1")!;
    const amountStacked = 500;
    const currentCycle = 0;
    const targetCycle = 1;
    const lockPeriod = 32;
    const cityId = 1;
    const userId = 1;
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    const expected = `{amountStacked: ${types.uint(amountStacked)}, cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, event: "stacking", firstCycle: ${types.uint(1)}, lastCycle: ${types.uint(targetCycle + lockPeriod - 1)}, lockPeriod: ${types.uint(lockPeriod)}, userId: ${types.uint(1)}}`;
    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd007-citycoin-stacking`, expected);
    for (let i = 0; i < lockPeriod; i++) {
      // console.log(`i: ${i}`);
      const stacker = ccd007CityStacking.getStacker(cityId, targetCycle + i, userId).result;
      assertEquals(stacker.expectTuple(), { claimable: types.uint(i === lockPeriod - 1 ? amountStacked : 0), stacked: types.uint(amountStacked) });
    }
  },
});

// =============================
// 2. claim-stacking-reward
// =============================

Clarinet.test({
  name: "ccd007-citycoin-stacking: claim-stacking-reward() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");

    // act
    const block = chain.mineBlock([ccd007CityStacking.claimStackingReward(sender, miaCityName, 1)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_CITY);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: claim-stacking-reward() fails if user is unknown",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    const block = chain.mineBlock([ccd007CityStacking.claimStackingReward(sender, miaCityName, 1)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INVALID_USER);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: claim-stacking-reward() fails if user has nothing to claim",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const poolOperator = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    //const ccd003UserRegistry = new CCD003UserRegistry(chain, sender, "ccd003-user-registry");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // set pool operator to wallet_2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    // fast forward past the first stacking cycle
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH * 2);

    const block = chain.mineBlock([ccd007CityStacking.claimStackingReward(user, miaCityName, 1)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: claim-stacking-reward() fails with ERR_NOTHING_TO_CLAIM if there is nothing to claim",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    const amountStacked = 500;
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
  name: "ccd007-citycoin-stacking: claim-stacking-reward() fails if reward cycle is incomplete",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const operator = accounts.get("wallet_2")!;
    const amountStacked = 500;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    // passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    // add mia stacking treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);

    // JS: stacking happens in the *next* reward cycle, and payouts happen
    // after the cycle is complete. Reward cycles follow Stacks PoX cycles.

    // stack during cycle 0, which starts in cycle 1
    const block0 = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, amountStacked, lockPeriod)]);
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(true);

    // attempt to claim reward for cycle 1
    const block2 = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, miaCityName, 1)]);

    // assert
    // confirm reward cycle 0 is active
    ccd007CityStacking.getRewardCycle(block2.height).result.expectUint(0);
    block0.receipts[0].result.expectOk().expectBool(true);
    //block1.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
    // confirm nothing stacked in cycle 0
    let expected: any = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 0, 1).result.expectTuple(), expected);
    // confirm stacked and return amounts in cycle 1
    expected = {
      claimable: types.uint(amountStacked),
      stacked: types.uint(amountStacked),
    };
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: claim-stacking-reward() fails if stacking payout is incomplete",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const amountStacked = 500;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH + 10);

    // attempt to claim reward for cycle 1
    const block2 = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, miaCityName, 1)]);

    // assert

    // confirm reward cycle 1 is active
    ccd007CityStacking.getRewardCycle(block2.height).result.expectUint(1);
    block0.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);

    // confirm nothing stacked in cycle 0 for the user
    let expected: any = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 0, 1).result.expectTuple(), expected);
    // confirm stacked and return amounts in cycle 1 for the user
    expected = {
      claimable: types.uint(amountStacked),
      stacked: types.uint(amountStacked),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 1, 1).result.expectTuple(), expected);
    // confirm reward amount is not set in overall cycle 1 data
    expected = {
      reward: types.none(),
      total: types.uint(amountStacked),
    };
    assertEquals(ccd007CityStacking.getStackingStats(miaCityId, 1).result.expectTuple(), expected);
    ccd007CityStacking.getStackingReward(miaCityId, 1, 0).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: claim-stacking-reward() succeeds if cycle has passed and stacking payout is complete",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const operator = accounts.get("wallet_2")!;
    const userId = 1;
    const amountStacked = 500;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH * 2 + 10);
    const block1 = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardMia(operator, 1, 150000)]);

    // mid point check of the stx/mia token balances
    let expected1 = {
      claimable: types.uint(500),
      stacked: types.uint(500),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 1, 1).result.expectTuple(), expected1);

    // confirm stacking reward is correct for the user and attempt to claim
    ccd007CityStacking.getStackingReward(miaCityId, 1, 1).result.expectSome().expectUint(150000);
    ccd002Treasury.getBalanceStx().result.expectUint(150000);
    const block2 = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, miaCityName, 1)]);

    // assert
    const expectedPrintMsg = `{cityId: u1, cityName: "mia", claimable: ${types.uint(500)}, cycleId: ${types.uint(1)}, event: "stacking-claim", reward: ${types.uint(150000)}, userId: ${types.uint(userId)}}`;
    block2.receipts[0].events.expectPrintEvent(`${sender.address}.ccd007-citycoin-stacking`, expectedPrintMsg);

    // confirm reward cycle 2 is active
    ccd007CityStacking.getRewardCycle(block2.height).result.expectUint(2);
    block0.receipts[0].result.expectOk().expectBool(true);
    block1.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectOk().expectBool(true);

    // confirm nothing stacked in cycle 0 for the user
    expected1 = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 1, 1).result.expectTuple(), expected1);
    // confirm reward amount is set in overall cycle 1 data
    const expected = {
      reward: types.some(types.uint(150000)),
      total: types.uint(amountStacked),
    };
    assertEquals(ccd007CityStacking.getStackingStats(miaCityId, 1).result.expectTuple(), expected);

    // end point check of the stx/mia token balances
    ccd002Treasury.getBalanceStx().result.expectUint(0);
    gt.getBalance(user1.address).result.expectOk().expectUint(1000);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: get-stacking-reward() returns correct default stacking data",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // act

    // assert
    ccd007CityStacking.getStackingReward(miaCityId, 1, 1).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: get-stacker-at-cycle() returns correct default stacking data",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // act

    // assert
    const expectedStats = {
      stacked: types.uint(0),
      claimable: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 1, 1).result.expectTuple(), expectedStats);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: get-first-block-in-reward-cycle() returns correct block for multiple cycles",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);

    // act
    // get or create user ID
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    // get or create city IDs
    passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);

    // assert
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH * 2 + 10);
    for (let i = 0; i < 10; i++) {
      ccd007CityStacking.getFirstBlockInRewardCycle(i).result.expectUint(CCD007CityStacking.REWARD_CYCLE_LENGTH * i + CCD007CityStacking.FIRST_STACKING_BLOCK);
    }
  },
});

// =============================
// 3. stacking-status
// =============================

Clarinet.test({
  name: "ccd007-citycoin-stacking: stack() fails if stacking is disabled in the contract",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const user1 = accounts.get("wallet_1")!;
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // 009 mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // 010 adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);
    // 012 disables the extension
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_012);
    const block = chain.mineBlock([ccd007CityStacking.stack(user1, miaCityName, 500, lockPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_STACKING_DISABLED);
    gt.getBalance(user1.address).result.expectOk().expectUint(1000);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: claim-stacking-reward() succeeds for a future cycle if stacking is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const operator = accounts.get("wallet_2")!;
    const userId = 1;
    const amountStacked = 500;
    const lockPeriod = 30;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");
    ccd007CityStacking.isStackingActive(miaCityId, 1).result.expectBool(false);
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

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
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH * 2 + 10);
    const block1 = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardMia(operator, 1, 150000)]);

    // mid point check of the stx/mia token balances
    let expected1 = {
      claimable: types.uint(0),
      stacked: types.uint(amountStacked),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 1, 1).result.expectTuple(), expected1);

    // disable stacking in ccd007
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_012);

    // confirm reward is still correctly shown for cycle 1
    ccd007CityStacking.getStackingReward(miaCityId, 1, 1).result.expectSome().expectUint(150000);
    // confirm claimable amount is correct for the user and
    // attempt to claim the final cycle to return CityCoins
    let expected2 = {
      claimable: types.uint(amountStacked),
      stacked: types.uint(amountStacked),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 30, 1).result.expectTuple(), expected2);
    const block2 = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, miaCityName, 30)]);
    // assert
    const expectedPrintMsg = `{cityId: u1, cityName: "mia", claimable: ${types.uint(500)}, cycleId: ${types.uint(30)}, event: "stacking-claim", reward: ${types.uint(0)}, userId: ${types.uint(userId)}}`;
    block2.receipts[0].events.expectPrintEvent(`${sender.address}.ccd007-citycoin-stacking`, expectedPrintMsg);

    // confirm reward cycle 2 is active
    ccd007CityStacking.getRewardCycle(block2.height).result.expectUint(2);
    block0.receipts[0].result.expectOk().expectBool(true);
    block1.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectOk().expectBool(true);

    // confirm nothing stacked in cycle 30 for the user after claim
    expected1 = {
      claimable: types.uint(0),
      stacked: types.uint(0),
    };
    assertEquals(ccd007CityStacking.getStacker(miaCityId, 1, 30).result.expectTuple(), expected1);

    // end point check of the stx/mia token balances
    gt.getBalance(user1.address).result.expectOk().expectUint(1000);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: set-stacking-enabled() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // act
    const block = chain.mineBlock([ccd007CityStacking.setStackingEnabled(sender, true)]);
    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd007-citycoin-stacking: get-stacking-status() returns true after deployment",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    // act
    // assert
    ccd007CityStacking.isStackingEnabled().result.expectBool(true);
  },
});
