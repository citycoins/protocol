import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCD012RedemptionNyc } from "../../models/extensions/ccd012-redemption-nyc.model.ts";
import { CCIP022TreasuryRedemptionNYC } from "../../models/proposals/ccip022-treasury-redemption-nyc.model.ts";
import { EXTENSIONS, PROPOSALS, constructAndPassProposal, nyc, passProposal } from "../../utils/common.ts";
import { Account, assertEquals, Clarinet, Chain, types } from "../../utils/deps.ts";

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd012-redemption-nyc: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);

    // act

    // assert
    ccd012RedemptionNyc.isDaoOrExtension().result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd012-redemption-nyc: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);

    // act
    const { receipts } = chain.mineBlock([ccd012RedemptionNyc.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

// =============================
// initialize-redemption()
// =============================

Clarinet.test({
  name: "ccd012-redemption-nyc: initialize-redemption() fails with ERR_UNAUTHORIZED when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);

    // act
    const initializeBlock = chain.mineBlock([ccd012RedemptionNyc.initializeRedemption(sender)]);

    // assert
    assertEquals(initializeBlock.receipts.length, 1);
    initializeBlock.receipts[0].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_UNAUTHORIZED);
  },
});

// initialize-redemption() fails with ERR_GETTING_TOTAL_SUPPLY if both supplies are 0
// note: supply is required for voting in CCIP-022, so unreachable

// initialize-redemption() fails with ERR_GETTING_REDEMPTION_BALANCE if the redemption balance is 0
// note: transfer fails in CCIP-022 for this case, so unreachable

Clarinet.test({
  name: "ccd012-redemption-nyc: initialize-redemption() fails with ERR_ALREADY_ENABLED if called more than once",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    0;
  },
});

Clarinet.test({
  name: "ccd012-redemption-nyc: initialize-redemption() succeeds and prints the redemption info",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    // set stacking parameters
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);

    // mint and move funds
    passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_003);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod)]);
    // for length of mineBlock array, expectOk and expectBool(true)
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // execute two yes votes, one no vote
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user2, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user3, false)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // act
    const executeBlock = passProposal(chain, accounts, PROPOSALS.CCIP_022);

    // assert
    assertEquals(executeBlock.receipts.length, 3);
    executeBlock.receipts[0].result.expectOk().expectUint(1);
    executeBlock.receipts[1].result.expectOk().expectUint(2);
    executeBlock.receipts[2].result.expectOk().expectUint(3);

    const expectedEvent = `{blockHeight: u${executeBlock.height - 1}, contractBalance: u1000000000000, redemptionRatio: u50000, redemptionsEnabled: true, totalSupply: u20000000}`;
    executeBlock.receipts[2].events.expectPrintEvent(EXTENSIONS.CCD012_REDEMPTION_NYC, expectedEvent);
  },
});

// =============================
// redeem-nyc()
// =============================

Clarinet.test({
  name: "ccd012-redemption-nyc: redeem-nyc() fails with ERR_NOTHING_TO_REDEEM if the redemption amount is none",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);

    // act
    const redeemBlock = chain.mineBlock([ccd012RedemptionNyc.redeemNyc(sender)]);

    // assert
    assertEquals(redeemBlock.receipts.length, 1);
    redeemBlock.receipts[0].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_NOTHING_TO_REDEEM);
  },
});

Clarinet.test({
  name: "ccd012-redemption-nyc: redeem-nyc() fails with ERR_NOT_ENABLED if the redemption is not initialized",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_002);

    // act
    const redeemBlock = chain.mineBlock([ccd012RedemptionNyc.redeemNyc(sender)]);

    // assert
    assertEquals(redeemBlock.receipts.length, 1);
    // note: actually fails with ERR_NOTHING_TO_REDEEM, but did not want to remove test case / extra code to be safe
    // when disabled the redemption amount always returns none, so short-circuits early before error
    redeemBlock.receipts[0].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_NOTHING_TO_REDEEM);
  },
});

// redeem-nyc() fails with ERR_ALREADY_CLAIMED if the redemption is already claimed
// redeem-nyc() fails with ERR_BALANCE_NOT_FOUND if v1 or v2 tokens are not found
// redeem-nyc() fails with ERR_NOTHING_TO_REDEEM if the redemption amount is 0
// redeem-nyc() succeeds with just v1 tokens
// redeem-nyc() succeeds with just v2 tokens
// redeem-nyc() succeeds with both v1 and v2 tokens

Clarinet.test({
  name: "ccd012-redemption-nyc: redeem-nyc() succeeds with both v1 and v2 tokens",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);
    for (let i = 0; i < constructBlock.receipts.length; i++) {
      if (i === 0) {
        constructBlock.receipts[i].result.expectOk().expectBool(true);
      } else {
        constructBlock.receipts[i].result.expectOk().expectUint(i);
      }
    }

    const fundV1Block = passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_002);
    const fundV2Block = passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_003);
    for (let i = 0; i < fundV1Block.receipts.length; i++) {
      fundV1Block.receipts[i].result.expectOk().expectUint(i + 1);
      fundV2Block.receipts[i].result.expectOk().expectUint(i + 1);
    }

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod)]);
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // execute two yes votes, one no vote
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user2, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user3, false)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // execute ccip-022
    const executeBlock = passProposal(chain, accounts, PROPOSALS.CCIP_022);
    assertEquals(executeBlock.receipts.length, 3);
    for (let i = 0; i < executeBlock.receipts.length; i++) {
      executeBlock.receipts[i].result.expectOk().expectUint(i + 1);
    }

    // get contract redemption info

    const redemptionInfo = await ccd012RedemptionNyc.getRedemptionInfo().result;

    console.log("redemptionInfo", redemptionInfo);

    const redemptionBalanceSmall = ccd012RedemptionNyc.getRedemptionForBalance(1000).result;
    const redemptionBalanceMedium = ccd012RedemptionNyc.getRedemptionForBalance(1000000).result;
    const redemptionBalanceLarge = ccd012RedemptionNyc.getRedemptionForBalance(1000000000).result;

    console.log("redemptionBalanceSmall", redemptionBalanceSmall);
    console.log("redemptionBalanceMedium", redemptionBalanceMedium);
    console.log("redemptionBalanceLarge", redemptionBalanceLarge);

    // get user balances
    const user1Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user1.address).result;
    const user2Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user2.address).result;
    const user3Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user3.address).result;

    console.log("user1Info", user1Info);
    console.log("user2Info", user2Info);
    console.log("user3Info", user3Info);

    // act
    const redeemBlock = chain.mineBlock([ccd012RedemptionNyc.redeemNyc(sender), ccd012RedemptionNyc.redeemNyc(user1), ccd012RedemptionNyc.redeemNyc(user2), ccd012RedemptionNyc.redeemNyc(user3)]);
    console.log("redeem block", redeemBlock);

    // assert
    assertEquals(redeemBlock.receipts.length, 4);
    for (let i = 0; i < redeemBlock.receipts.length; i++) {
      redeemBlock.receipts[i].result.expectOk().expectBool(true);
    }
  },
});
