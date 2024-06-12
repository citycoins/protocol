import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCD012RedemptionNyc } from "../../models/extensions/ccd012-redemption-nyc.model.ts";
import { CCIP022TreasuryRedemptionNYC } from "../../models/proposals/ccip022-treasury-redemption-nyc.model.ts";
import { EXTENSIONS, PROPOSALS, constructAndPassProposal, nyc, parseClarityTuple, passProposal } from "../../utils/common.ts";
import { Account, Clarinet, Chain, assertEquals, assertAlmostEquals } from "../../utils/deps.ts";

// used for asset identifier in detecting burn events
const NYC_V1_TOKEN = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-nyc-v1::newyorkcitycoin";
const NYC_V2_TOKEN = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-nyc::newyorkcitycoin";

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
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
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
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod)]);
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

    const executeBlock = passProposal(chain, accounts, PROPOSALS.CCIP_022);

    assertEquals(executeBlock.receipts.length, 3);
    for (let i = 0; i < executeBlock.receipts.length; i++) {
      executeBlock.receipts[i].result.expectOk().expectUint(i + 1);
    }

    const expectedEvent = `{notification: "intialize-contract", payload: {blockHeight: u12611, contractBalance: u15000000000000, currentContractBalance: u15000000000000, redemptionRatio: u292282, redemptionsEnabled: true, totalRedeemed: u0, totalSupply: u5132020000000000}}`;
    // redemption ratio obtained through console logging below
    // console.log(expectedEvent);
    // console.log(executeBlock.receipts[2].events[3].contract_event.value);

    executeBlock.receipts[2].events.expectPrintEvent(EXTENSIONS.CCD012_REDEMPTION_NYC, expectedEvent);

    // act
    const secondInit = passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_004);

    // assert
    assertEquals(secondInit.receipts.length, 3);
    secondInit.receipts[0].result.expectOk().expectUint(1);
    secondInit.receipts[1].result.expectOk().expectUint(2);
    secondInit.receipts[2].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_ALREADY_ENABLED);
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
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod)]);
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
    for (let i = 0; i < executeBlock.receipts.length; i++) {
      executeBlock.receipts[i].result.expectOk().expectUint(i + 1);
    }

    const expectedEvent = `{notification: "intialize-contract", payload: {blockHeight: u12611, contractBalance: u15000000000000, currentContractBalance: u15000000000000, redemptionRatio: u292282, redemptionsEnabled: true, totalRedeemed: u0, totalSupply: u5132020000000000}}`;
    // redemption ratio obtained through console logging below
    // console.log(expectedEvent);
    // console.log(executeBlock.receipts[2].events[3].contract_event.value);

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
    // note: actually fails with ERR_NOTHING_TO_REDEEM, but did not want to remove test case / extra code to be safe
    // check was moved from let statement into function body with assert
    // before being initialized the redemption amount always returns none, so short-circuits early before error
    redeemBlock.receipts[0].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_NOT_ENABLED);
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
    redeemBlock.receipts[0].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_NOT_ENABLED);
  },
});

// redeem-nyc() fails with ERR_ALREADY_CLAIMED if the redemption is already claimed
// redeem-nyc() fails with ERR_BALANCE_NOT_FOUND if v1 or v2 tokens are not found
// redeem-nyc() fails with ERR_NOTHING_TO_REDEEM if the redemption amount is 0

Clarinet.test({
  name: "ccd012-redemption-nyc: redeem-nyc() succeeds with only v1 tokens",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const user4 = accounts.get("wallet_4")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const amountStacked = 10000000000; // match balance for user
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
    const fundV2SenderBlock = passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_005);
    for (let i = 0; i < fundV1Block.receipts.length; i++) {
      fundV1Block.receipts[i].result.expectOk().expectUint(i + 1);
      fundV2SenderBlock.receipts[i].result.expectOk().expectUint(i + 1);
    }

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(sender, nyc.cityName, amountStacked, lockPeriod)]);
    // console.log("stackingBlock", stackingBlock);
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // execute one yes vote
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(sender, true)]);
    // console.log("votingBlock", votingBlock);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // execute ccip-022
    const executeBlock = passProposal(chain, accounts, PROPOSALS.CCIP_022);
    // console.log("executeBlock", executeBlock);
    assertEquals(executeBlock.receipts.length, 3);
    for (let i = 0; i < executeBlock.receipts.length; i++) {
      executeBlock.receipts[i].result.expectOk().expectUint(i + 1);
    }

    // get contract redemption info

    const redemptionInfo = await ccd012RedemptionNyc.getRedemptionInfo().result;
    // console.log("v1 only redemptionInfo", parseClarityTuple(redemptionInfo));

    // get user balances
    const user1Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user1.address).result;
    const user2Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user2.address).result;
    const user3Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user3.address).result;
    const user4Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user4.address).result;

    const user1InfoObject = parseClarityTuple(user1Info);
    const user2InfoObject = parseClarityTuple(user2Info);
    const user3InfoObject = parseClarityTuple(user3Info);
    const user4InfoObject = parseClarityTuple(user4Info);

    const userInfoObjects = [user1InfoObject, user2InfoObject, user3InfoObject, user4InfoObject];

    // act
    const redeemBlock = chain.mineBlock([ccd012RedemptionNyc.redeemNyc(sender), ccd012RedemptionNyc.redeemNyc(user1), ccd012RedemptionNyc.redeemNyc(user2), ccd012RedemptionNyc.redeemNyc(user3), ccd012RedemptionNyc.redeemNyc(user4)]);
    // console.log("v1 only redeem block", redeemBlock);

    // assert
    assertEquals(redeemBlock.receipts.length, 5);
    for (let i = 0; i < redeemBlock.receipts.length; i++) {
      if (i === 0) {
        redeemBlock.receipts[i].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_BALANCE_NOT_FOUND);
      } else {
        redeemBlock.receipts[i].result
          .expectOk()
          .expectSome()
          .expectUint(userInfoObjects[i - 1].redemptionAmount);
        const expectedBurnEvent = {
          asset_identifier: NYC_V1_TOKEN,
          sender: userInfoObjects[i - 1].address,
          amount: userInfoObjects[i - 1].nycBalances.balanceV1,
        };
        redeemBlock.receipts[i].events.expectFungibleTokenBurnEvent(expectedBurnEvent.amount, expectedBurnEvent.sender, expectedBurnEvent.asset_identifier);
      }
    }
    // console.log("----------");
    // console.log("user1Info", user1InfoObject);
    // console.log("user2Info", user2InfoObject);
    // console.log("user3Info", user3InfoObject);
    // console.log("user4Info", user4InfoObject);
    // console.log("----------");
  },
});

Clarinet.test({
  name: "ccd012-redemption-nyc: redeem-nyc() succeeds with only v2 tokens",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const user4 = accounts.get("wallet_4")!;
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

    const fundV2Block = passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_003);
    for (let i = 0; i < fundV2Block.receipts.length; i++) {
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
    // console.log("v2 only redemptionInfo", parseClarityTuple(redemptionInfo));

    // get user balances
    const user1Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user1.address).result;
    const user2Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user2.address).result;
    const user3Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user3.address).result;
    const user4Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user4.address).result;

    const user1InfoObject = parseClarityTuple(user1Info);
    const user2InfoObject = parseClarityTuple(user2Info);
    const user3InfoObject = parseClarityTuple(user3Info);
    const user4InfoObject = parseClarityTuple(user4Info);

    const userInfoObjects = [user1InfoObject, user2InfoObject, user3InfoObject, user4InfoObject];

    // act
    const redeemBlock = chain.mineBlock([ccd012RedemptionNyc.redeemNyc(sender), ccd012RedemptionNyc.redeemNyc(user1), ccd012RedemptionNyc.redeemNyc(user2), ccd012RedemptionNyc.redeemNyc(user3), ccd012RedemptionNyc.redeemNyc(user4)]);
    // console.log("v2 only redeem block", redeemBlock);

    // assert
    assertEquals(redeemBlock.receipts.length, 5);
    for (let i = 0; i < redeemBlock.receipts.length; i++) {
      if (i === 0) {
        redeemBlock.receipts[i].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_BALANCE_NOT_FOUND);
      } else {
        redeemBlock.receipts[i].result
          .expectOk()
          .expectSome()
          .expectUint(userInfoObjects[i - 1].redemptionAmount);
        const expectedBurnEvent = {
          asset_identifier: NYC_V2_TOKEN,
          sender: userInfoObjects[i - 1].address,
          amount: userInfoObjects[i - 1].nycBalances.balanceV2,
        };
        redeemBlock.receipts[i].events.expectFungibleTokenBurnEvent(expectedBurnEvent.amount, expectedBurnEvent.sender, expectedBurnEvent.asset_identifier);
      }
    }
    // console.log("----------");
    // console.log("user1Info", user1InfoObject);
    // console.log("user2Info", user2InfoObject);
    // console.log("user3Info", user3InfoObject);
    // console.log("user4Info", user4InfoObject);
    // console.log("----------");
  },
});

Clarinet.test({
  name: "ccd012-redemption-nyc: redeem-nyc() succeeds with both v1 and v2 tokens",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const user4 = accounts.get("wallet_4")!;
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
    // console.log("v1 + v2 redemptionInfo", parseClarityTuple(redemptionInfo));

    // get user balances
    const user1Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user1.address).result;
    const user2Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user2.address).result;
    const user3Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user3.address).result;
    const user4Info = await ccd012RedemptionNyc.getUserRedemptionInfo(user4.address).result;

    const user1InfoObject = parseClarityTuple(user1Info);
    const user2InfoObject = parseClarityTuple(user2Info);
    const user3InfoObject = parseClarityTuple(user3Info);
    const user4InfoObject = parseClarityTuple(user4Info);

    const userInfoObjects = [user1InfoObject, user2InfoObject, user3InfoObject, user4InfoObject];

    // act
    const redeemBlock = chain.mineBlock([ccd012RedemptionNyc.redeemNyc(sender), ccd012RedemptionNyc.redeemNyc(user1), ccd012RedemptionNyc.redeemNyc(user2), ccd012RedemptionNyc.redeemNyc(user3), ccd012RedemptionNyc.redeemNyc(user4)]);
    // console.log("v1 + v2 redeem block", redeemBlock);

    // assert
    assertEquals(redeemBlock.receipts.length, 5);
    for (let i = 0; i < redeemBlock.receipts.length; i++) {
      if (i === 0) {
        redeemBlock.receipts[i].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_BALANCE_NOT_FOUND);
      } else {
        redeemBlock.receipts[i].result
          .expectOk()
          .expectSome()
          .expectUint(userInfoObjects[i - 1].redemptionAmount);
        const expectedBurnEventV1 = {
          asset_identifier: NYC_V1_TOKEN,
          sender: userInfoObjects[i - 1].address,
          amount: userInfoObjects[i - 1].nycBalances.balanceV1,
        };
        const expectedBurnEventV2 = {
          asset_identifier: NYC_V2_TOKEN,
          sender: userInfoObjects[i - 1].address,
          amount: userInfoObjects[i - 1].nycBalances.balanceV2,
        };
        redeemBlock.receipts[i].events.expectFungibleTokenBurnEvent(expectedBurnEventV1.amount, expectedBurnEventV1.sender, expectedBurnEventV1.asset_identifier);
        redeemBlock.receipts[i].events.expectFungibleTokenBurnEvent(expectedBurnEventV2.amount, expectedBurnEventV2.sender, expectedBurnEventV2.asset_identifier);
      }
    }
    // console.log("----------");
    // console.log("user1Info", user1InfoObject);
    // console.log("user2Info", user2InfoObject);
    // console.log("user3Info", user3InfoObject);
    // console.log("user4Info", user4InfoObject);
    // console.log("----------");
  },
});

type RedemptionInfo = {
  blockHeight: number;
  contractBalance: number;
  currentContractBalance: number;
  redemptionRatio: number;
  redemptionsEnabled: boolean;
  totalRedeemed: number;
  totalSupply: number;
};

type UserInfo = {
  address: string;
  nycBalances: {
    address: string;
    balanceV1: number;
    balanceV2: number;
    totalBalance: number;
  };
  redemptionAmount: number;
  redemptionClaims: number;
};

Clarinet.test({
  name: "ccd012-redemption-nyc: redeem-nyc() succeeds with additional claims after unstacking tokens",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!; // 10k NYC
    const user2 = accounts.get("wallet_2")!; // 1M NYC
    const user3 = accounts.get("wallet_3")!; // 5M NYC
    const user4 = accounts.get("wallet_4")!; // 10M NYC
    const user5 = accounts.get("wallet_5")!; // 100M NYC
    const user6 = accounts.get("wallet_6")!; // 1B NYC
    const user7 = accounts.get("wallet_7")!; // 4B NYC
    const users = [user1, user2, user3, user4, user5, user6, user7];
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const amountStacked = 10000;
    const lockPeriod = 10;

    const redemptionDecimals = 8;
    const redemptionScaleFactor = 10 ** redemptionDecimals;
    const redemptionTolerance = 1e-4;

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

    // fund accounts with V1 and V2 NYC
    const fundV1Block = passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_002);
    const fundV2Block = passProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_003);
    for (let i = 0; i < fundV1Block.receipts.length; i++) {
      fundV1Block.receipts[i].result.expectOk().expectUint(i + 1);
      fundV2Block.receipts[i].result.expectOk().expectUint(i + 1);
    }

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked * 2, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked * 3, lockPeriod), ccd007CityStacking.stack(user4, nyc.cityName, amountStacked * 4, lockPeriod)]);
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
    const redemptionInfo: RedemptionInfo = await ccd012RedemptionNyc.getRedemptionInfo().result;
    const redemptionInfoObject = parseClarityTuple(redemptionInfo);
    console.log("------------------------------");
    console.log("contract redemption info after ccip-022 execution:");
    console.log(redemptionInfoObject);

    // calculate the redemption ratios for comparison
    const redemptionRatioInContract = redemptionInfoObject.redemptionRatio / redemptionScaleFactor;
    const redemptionRatioInTest = redemptionInfoObject.contractBalance / redemptionInfoObject.totalSupply;
    console.log("------------------------------");
    console.log("contract redemption ratio after ccip-022 execution:");
    console.log("ratio in contract: ", redemptionRatioInContract);
    console.log("ratio calc in test: ", redemptionRatioInTest);

    // check that the ratio is correctly set based on known balance and total supply
    assertAlmostEquals(redemptionRatioInContract, redemptionRatioInTest, redemptionTolerance);

    // check that the contract balance is equal to first known balance minus redeemed amount by all users
    assertEquals(Number(redemptionInfoObject.currentContractBalance), redemptionInfoObject.contractBalance - redemptionInfoObject.totalRedeemed);

    // get user balances from users array
    const userInfoObjects: UserInfo[] = [];
    for (let i = 0; i < users.length; i++) {
      const userInfo = await ccd012RedemptionNyc.getUserRedemptionInfo(users[i].address).result;
      const userInfoObject = parseClarityTuple(userInfo);
      userInfoObjects.push(userInfoObject);
    }
    console.log("------------------------------");
    console.log("user redemption info after ccip-022 execution:");
    userInfoObjects.map((userInfo, idx) => {
      console.log("user " + (idx + 1) + " info: ", userInfo);
    });

    console.log("------------------------------");
    console.log("user redemption ratios before first redemption:");
    const redemptionRatios = userInfoObjects.map((userInfo) => {
      if (userInfo.nycBalances.totalBalance > 0) {
        return userInfo.redemptionAmount / userInfo.nycBalances.totalBalance;
      }
      return 0;
    });
    for (let i = 0; i < redemptionRatios.length; i++) {
      console.log("redemption ratio user " + (i + 1) + ": ", redemptionRatios[i]);
      assertAlmostEquals(redemptionRatios[i], redemptionRatioInContract, redemptionTolerance);
    }

    // redeem token balances once for users 1-4
    // leave users 5-7 untouched with a large balance
    const firstRedeemBlock = chain.mineBlock([ccd012RedemptionNyc.redeemNyc(sender), ccd012RedemptionNyc.redeemNyc(user1), ccd012RedemptionNyc.redeemNyc(user2), ccd012RedemptionNyc.redeemNyc(user3), ccd012RedemptionNyc.redeemNyc(user4)]);
    console.log("------------------------------");
    console.log("firstRedeemBlock", firstRedeemBlock);
    assertEquals(firstRedeemBlock.receipts.length, userInfoObjects.length - 2);

    for (let i = 0; i < firstRedeemBlock.receipts.length; i++) {
      // expect first claim to fail with no NYC balance
      if (i === 0) {
        firstRedeemBlock.receipts[i].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_BALANCE_NOT_FOUND);
      } else {
        // claim should succeed for all other users
        firstRedeemBlock.receipts[i].result
          .expectOk()
          .expectSome()
          .expectUint(userInfoObjects[i - 1].redemptionAmount);
        // if there was a v1 balance, we should see a v1 burn event
        if (userInfoObjects[i - 1].nycBalances.balanceV1 > 0) {
          const expectedBurnEventV1 = {
            asset_identifier: NYC_V1_TOKEN,
            sender: userInfoObjects[i - 1].address,
            amount: userInfoObjects[i - 1].nycBalances.balanceV1,
          };
          firstRedeemBlock.receipts[i].events.expectFungibleTokenBurnEvent(expectedBurnEventV1.amount, expectedBurnEventV1.sender, expectedBurnEventV1.asset_identifier);
        }
        // if there was a v2 balance, we should see a v2 burn event
        if (userInfoObjects[i - 1].nycBalances.balanceV2 > 0) {
          const expectedBurnEventV2 = {
            asset_identifier: NYC_V2_TOKEN,
            sender: userInfoObjects[i - 1].address,
            amount: userInfoObjects[i - 1].nycBalances.balanceV2,
          };
          firstRedeemBlock.receipts[i].events.expectFungibleTokenBurnEvent(expectedBurnEventV2.amount, expectedBurnEventV2.sender, expectedBurnEventV2.asset_identifier);
        }
      }
    }

    // claim stacking rewards from cycle u10
    // progress the chain to cycle 15
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 16 + 10);
    const stackingClaimBlock = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, nyc.cityName, 10), ccd007CityStacking.claimStackingReward(user2, nyc.cityName, 10), ccd007CityStacking.claimStackingReward(user3, nyc.cityName, 10), ccd007CityStacking.claimStackingReward(user4, nyc.cityName, 10)]);
    // console.log("stackingClaimBlock", stackingClaimBlock);
    for (let i = 0; i < stackingClaimBlock.receipts.length; i++) {
      stackingClaimBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // get contract redemption info
    const redemptionInfo2 = await ccd012RedemptionNyc.getRedemptionInfo().result;
    const redemptionInfoObject2 = parseClarityTuple(redemptionInfo2);
    console.log("------------------------------");
    console.log("contract redemption info after first redemption:");
    console.log(redemptionInfoObject2);

    // check that the contract balance is equal to first known balance minus redeemed amount by all users
    assertEquals(Number(redemptionInfoObject2.currentContractBalance), redemptionInfoObject2.contractBalance - redemptionInfoObject2.totalRedeemed);

    // get user balances from users array
    const userInfoObjects2: UserInfo[] = [];
    for (let i = 0; i < users.length; i++) {
      const userInfo = await ccd012RedemptionNyc.getUserRedemptionInfo(users[i].address).result;
      const userInfoObject = parseClarityTuple(userInfo);
      userInfoObjects2.push(userInfoObject);
    }
    console.log("------------------------------");
    console.log("user redemption info after first redemption:");
    userInfoObjects2.map((userInfo, idx) => {
      console.log("user " + (idx + 1) + " info: ", userInfo);
    });

    console.log("------------------------------");
    console.log("redemption ratios before second redemption:");
    const redemptionRatios2 = userInfoObjects2.map((userInfo) => {
      if (userInfo.nycBalances.totalBalance > 0) {
        return userInfo.redemptionAmount / userInfo.nycBalances.totalBalance;
      }
      return 0;
    });
    for (let i = 0; i < redemptionRatios2.length; i++) {
      console.log("redemption ratio user " + (i + 1) + ": ", redemptionRatios2[i]);
      assertAlmostEquals(redemptionRatios2[i], redemptionRatioInContract, redemptionTolerance);
    }

    // act
    // redeem token balances once for each user
    const secondRedeemBlock = chain.mineBlock([ccd012RedemptionNyc.redeemNyc(sender), ccd012RedemptionNyc.redeemNyc(user1), ccd012RedemptionNyc.redeemNyc(user2), ccd012RedemptionNyc.redeemNyc(user3), ccd012RedemptionNyc.redeemNyc(user4), ccd012RedemptionNyc.redeemNyc(user5), ccd012RedemptionNyc.redeemNyc(user6), ccd012RedemptionNyc.redeemNyc(user7)]);
    console.log("------------------------------");
    console.log("secondRedeemBlock", secondRedeemBlock);
    assertEquals(secondRedeemBlock.receipts.length, userInfoObjects2.length + 1);

    // assert
    for (let i = 0; i < secondRedeemBlock.receipts.length; i++) {
      // expect first claim to fail with no NYC balance
      if (i === 0) {
        secondRedeemBlock.receipts[i].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_BALANCE_NOT_FOUND);
      } else {
        // claim should succeed for all other users
        secondRedeemBlock.receipts[i].result
          .expectOk()
          .expectSome()
          .expectUint(userInfoObjects2[i - 1].redemptionAmount);
        // if there was a v1 balance, we should see a v1 burn event
        if (userInfoObjects2[i - 1].nycBalances.balanceV1 > 0) {
          const expectedBurnEventV1 = {
            asset_identifier: NYC_V1_TOKEN,
            sender: userInfoObjects2[i - 1].address,
            amount: userInfoObjects2[i - 1].nycBalances.balanceV1,
          };
          secondRedeemBlock.receipts[i].events.expectFungibleTokenBurnEvent(expectedBurnEventV1.amount, expectedBurnEventV1.sender, expectedBurnEventV1.asset_identifier);
        }
        // if there was a v2 balance, we should see a v2 burn event
        if (userInfoObjects2[i - 1].nycBalances.balanceV2 > 0) {
          const expectedBurnEventV2 = {
            asset_identifier: NYC_V2_TOKEN,
            sender: userInfoObjects2[i - 1].address,
            amount: userInfoObjects2[i - 1].nycBalances.balanceV2,
          };
          secondRedeemBlock.receipts[i].events.expectFungibleTokenBurnEvent(expectedBurnEventV2.amount, expectedBurnEventV2.sender, expectedBurnEventV2.asset_identifier);
        }
      }
    }

    // get the redemption info from the contract for analysis
    const redemptionInfo3 = await ccd012RedemptionNyc.getRedemptionInfo().result;
    const redemptionInfoObject3 = parseClarityTuple(redemptionInfo3);

    console.log("------------------------------");
    console.log("contract redemption info after second redemption:");
    console.log(redemptionInfoObject3);

    // check that the contract balance is equal to first known balance minus redeemed amount by all users
    assertEquals(Number(redemptionInfoObject3.currentContractBalance), redemptionInfoObject3.contractBalance - redemptionInfoObject3.totalRedeemed);

    // get user balances from users array
    const userInfoObjects3: UserInfo[] = [];
    for (let i = 0; i < users.length; i++) {
      const userInfo = await ccd012RedemptionNyc.getUserRedemptionInfo(users[i].address).result;
      const userInfoObject = parseClarityTuple(userInfo);
      userInfoObjects3.push(userInfoObject);
    }
    console.log("------------------------------");
    console.log("user redemption info after second redemption:");
    userInfoObjects3.map((userInfo, idx) => {
      console.log("user " + (idx + 1) + " info: ", userInfo);
    });
  },
});
