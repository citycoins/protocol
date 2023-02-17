import { Account, assertEquals, Clarinet, Chain, types } from "../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD002Treasury } from "../../models/extensions/ccd002-treasury.model.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCD011StackingPayouts } from "../../models/extensions/ccd011-stacking-payouts.model.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================

const lockingPeriod = 32;

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd011-stacking-payouts: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");

    // act

    // assert
    ccd011StackingPayouts.isDaoOrExtension().result.expectErr().expectUint(CCD011StackingPayouts.ErrCode.ERR_UNAUTHORIZED);
  },
});

// =============================
// 1. set-pool-operator
// =============================

Clarinet.test({
  name: "ccd011-stacking-payouts: set-pool-operator() fails if called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");

    // act
    const block = chain.mineBlock([ccd011StackingPayouts.setPoolOperator(sender, sender.address)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD011StackingPayouts.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd011-stacking-payouts: set-pool-operator() successfully sets a new pool operator",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");
    // MAINNET: ccd011StackingPayouts.getPoolOperator().result.expectSome().expectPrincipal("SPFP0018FJFD82X3KCKZRGJQZWRCV9793QTGE87M");
    ccd011StackingPayouts.getPoolOperator().result.expectPrincipal("ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6");

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);

    // assert
    receipts[3].result.expectOk().expectUint(3);
    ccd011StackingPayouts.getPoolOperator().result.expectPrincipal("ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG");
  },
});

// =============================
// 2. send-stacking-reward
// =============================

Clarinet.test({
  name: "ccd011-stacking-payouts: send-stacking-reward() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");

    // act
    const block = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardMia(sender, 2, 5000)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD011StackingPayouts.ErrCode.ERR_INVALID_CITY);
  },
});

Clarinet.test({
  name: "ccd011-stacking-payouts: send-stacking-reward() fails if not called by pool operator",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("wallet_1")!;
    const amount = 1000000000;
    //const operator = accounts.get("wallet_1")!;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD011StackingPayouts.FIRST_STACKING_BLOCK);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);

    const block = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardMia(sender, 1, amount)]);
    // assert
    block.receipts[0].result.expectErr().expectUint(CCD011StackingPayouts.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd011-stacking-payouts: send-stacking-reward() fails if payout amount is 0",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD011StackingPayouts.FIRST_STACKING_BLOCK);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);

    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    chain.mineEmptyBlock(CCD011StackingPayouts.REWARD_CYCLE_LENGTH * 2);
    const block = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardMia(operator, 1, 0)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD011StackingPayouts.ErrCode.ERR_INVALID_PAYOUT);
  },
});

Clarinet.test({
  name: "ccd011-stacking-payouts: send-stacking-reward() fails if sent during the current cycle",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");

    // act
    // register MIA/NYC
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set activation status: true
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // set pool operator to wallet_2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    // add mia stacking treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // progress the chain
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH * 5);

    const currentCycle = ccd007CityStacking.getCurrentRewardCycle().result;
    //console.log(`currentCycle: ${currentCycle}`);
    // forgive the hackiness here
    const currentCycleNum = +currentCycle.replace("u", "");
    //console.log(`currentCycleNum: ${currentCycleNum}`);
    const block = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardMia(operator, currentCycleNum, 50000)]);
    //console.log(`block\n${JSON.stringify(block, null, 2)}`);
    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INCOMPLETE_CYCLE);
  },
});

Clarinet.test({
  name: "ccd011-stacking-payouts: send-stacking-reward() fails if sent for a future cycle",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");

    // act
    // register MIA/NYC
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set activation details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set activation status: true
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // set pool operator to wallet_2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    // add mia stacking treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // progress the chain
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH * 5);

    const currentCycle = ccd007CityStacking.getCurrentRewardCycle().result;
    //console.log(`currentCycle: ${currentCycle}`);
    // forgive the hackiness here
    const currentCycleNum = +currentCycle.replace("u", "");
    //console.log(`currentCycleNum: ${currentCycleNum}`);
    const block = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardMia(operator, currentCycleNum + 1, 50000)]);
    //console.log(`block\n${JSON.stringify(block, null, 2)}`);
    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_INCOMPLETE_CYCLE);
  },
});

Clarinet.test({
  name: "ccd011-stacking-payouts: send-stacking-reward() successfully sends funds to the mia treasury",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const targetCycle = 10;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    // add mia stacking treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // fast forward past the target cycle
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH * (targetCycle + 1) + 1);

    const block = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardMia(operator, 10, 50000)]);

    // assert
    ccd002Treasury.getBalanceStx().result.expectUint(50000);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd011-stacking-payouts: send-stacking-reward() successfully sends funds to the nyc treasury",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const operator = accounts.get("wallet_2")!;
    const targetCycle = 10;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-stacking");
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_008);
    chain.mineEmptyBlock(CCD007CityStacking.REWARD_CYCLE_LENGTH * (targetCycle + 1) + 1);

    const block = chain.mineBlock([ccd011StackingPayouts.sendStackingRewardNyc(operator, 10, 50000)]);

    // assert
    ccd002Treasury.getBalanceStx().result.expectUint(50000);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

// Extension callback

Clarinet.test({
  name: "ccd011-stacking-payouts: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd011StackingPayouts = new CCD011StackingPayouts(chain, sender, "ccd011-stacking-payouts");

    // act
    const { receipts } = chain.mineBlock([ccd011StackingPayouts.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});
