import { Account, Clarinet, Chain, types } from "../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS, mia, nyc, CCD006_REWARD_DELAY } from "../../utils/common.ts";
import { CCD006CityMining } from "../../models/extensions/ccd006-citycoin-mining.model.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCIP022TreasuryRedemptionNYC } from "../../models/proposals/ccip022-treasury-redemption-nyc.model.ts";
import { CCIP014Pox3 } from "../../models/proposals/ccip014-pox-3.model.ts";

// helper function to print voting data for users 1, 2, and 3
function printVotingData(ccd007: CCD007CityStacking, ccip022: CCIP022TreasuryRedemptionNYC) {
  console.log("contract vote totals nyc:");
  console.log(JSON.stringify(ccip022.getVoteTotalNyc(), null, 2));
  console.log("contract vote totals:");
  console.log(JSON.stringify(ccip022.getVoteTotals(), null, 2));

  console.log("user 1:");
  console.log(ccip022.getVoterInfo(1));
  console.log("user 1 NYC:");
  console.log(ccd007.getStacker(nyc.cityId, 2, 1));
  console.log(ccip022.getNycVote(1, false));
  console.log(ccip022.getNycVote(1, true));

  console.log("user 2:");
  console.log(ccip022.getVoterInfo(2));
  console.log("user 2 NYC:");
  console.log(ccd007.getStacker(nyc.cityId, 2, 2));
  console.log(ccip022.getNycVote(2, false));
  console.log(ccip022.getNycVote(2, true));

  console.log("user 3:");
  console.log(ccip022.getVoterInfo(3));
  console.log("user 3 NYC:");
  console.log(ccd007.getStacker(nyc.cityId, 2, 3));
  console.log(ccip022.getNycVote(3, false));
  console.log(ccip022.getNycVote(3, true));
}

Clarinet.test({
  name: "ccip-022: execute() fails with ERR_VOTE_FAILED if there are no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);

    // act

    // execute ccip-022
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_022);

    // assert
    block.receipts[2].result.expectErr().expectUint(CCIP022TreasuryRedemptionNYC.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-022: execute() fails with ERR_VOTE_FAILED if there are more no than yes votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod)]);
    // make sure every transaction succeeded
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // act

    // execute two no votes
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, false), ccip022TreasuryRedemptionNyc.voteOnProposal(user2, false)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    /* double check voting data
    console.log(`voting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    printVotingData(ccd007CityStacking, ccip022TreasuryRedemptionNyc);
    */

    // execute ccip-022
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_022);

    // assert
    block.receipts[2].result.expectErr().expectUint(CCIP022TreasuryRedemptionNYC.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-022: execute() succeeds if there is a single yes vote",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const blocksMined = 10;
    const amountPerBlock = 25000000;
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);

    // mine to put some funds in the treasury
    const miningEntries = Array.from({ length: blocksMined }, () => amountPerBlock);
    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(sender, nyc.cityName, miningEntries)]);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod)]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // blocks to claim is an array of block heights
    // starting with the miningBlock height
    // and ending after blocksMined blocks
    const blocksToClaim = Array.from({ length: blocksMined }, (_, i) => miningBlock.height + i - 1);

    // claim mined blocks to increase total supply
    const claimBlock = chain.mineBlock(blocksToClaim.map((height) => ccd006CityMiningV2.claimMiningReward(sender, nyc.cityName, height)));
    for (let i = 0; i < claimBlock.receipts.length; i++) {
      claimBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // act

    // execute two yes votes with MIA only
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true)]);
    votingBlock.receipts[0].result.expectOk().expectBool(true);

    /* double check voting data
    console.log(`voting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    printVotingData(ccd007CityStacking, ccip022TreasuryRedemptionNyc);
    */

    // execute ccip-022
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_022);

    // assert
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-022: execute() succeeds if there are more yes than no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const blocksMined = 10;
    const amountPerBlock = 25000000;
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);

    // mine to put some funds in the treasury
    const miningEntries = Array.from({ length: blocksMined }, () => amountPerBlock);
    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(sender, nyc.cityName, miningEntries)]);

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

    // blocks to claim is an array of block heights
    // starting with the miningBlock height
    // and ending after blocksMined blocks
    const blocksToClaim = Array.from({ length: blocksMined }, (_, i) => miningBlock.height + i - 1);

    // claim mined blocks to increase total supply
    const claimBlock = chain.mineBlock(blocksToClaim.map((height) => ccd006CityMiningV2.claimMiningReward(sender, nyc.cityName, height)));
    for (let i = 0; i < claimBlock.receipts.length; i++) {
      claimBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // act

    // execute two yes votes, one no vote
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user2, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user3, false)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // double check voting data
    // console.log(`voting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    // printVotingData(ccd007CityStacking, ccip022TreasuryRedemptionNyc);

    // execute ccip-022
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_022);

    // assert
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-022: execute() succeeds if there are more yes than no votes after a reversal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const blocksMined = 10;
    const amountPerBlock = 25000000;
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);

    // mine to put some funds in the treasury
    const miningEntries = Array.from({ length: blocksMined }, () => amountPerBlock);
    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(sender, nyc.cityName, miningEntries)]);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod)]);
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // blocks to claim is an array of block heights
    // starting with the miningBlock height
    // and ending after blocksMined blocks
    const blocksToClaim = Array.from({ length: blocksMined }, (_, i) => miningBlock.height + i - 1);

    // claim mined blocks to increase total supply
    const claimBlock = chain.mineBlock(blocksToClaim.map((height) => ccd006CityMiningV2.claimMiningReward(sender, nyc.cityName, height)));
    for (let i = 0; i < claimBlock.receipts.length; i++) {
      claimBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // act

    // execute two yes votes, one no vote
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user2, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user3, false)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    /* double check voting data
    console.log("BEFORE REVERSAL");
    console.log(`voting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    printVotingData(ccd007CityStacking, ccip022TreasuryRedemptionNyc);
    */

    const votingBlockReversed = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user3, true)]);
    votingBlockReversed.receipts[0].result.expectOk().expectBool(true);

    /* double check voting data
    console.log("AFTER REVERSAL");
    console.log(`voting block reversed:\n${JSON.stringify(votingBlockReversed, null, 2)}`);
    printVotingData(ccd007CityStacking, ccip022TreasuryRedemptionNyc);
    */

    // execute ccip-022
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_022);

    // assert
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-022: vote-on-proposal() fails with ERR_USER_NOT_FOUND if user is not registered in ccd003-user-registry",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // prepare for CCIP (sets up cities, tokens, and data)
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);
    constructBlock.receipts[0].result.expectOk().expectBool(true);

    // mine to put funds in the mining treasury
    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, nyc.cityName, miningEntries), ccd006CityMiningV2.mine(user2, nyc.cityName, miningEntries)]);
    for (let i = 0; i < miningBlock.receipts.length; i++) {
      miningBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked / 2, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked / 2, lockPeriod)]);
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // act
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user2, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user3, true)]);

    // assert
    votingBlock.receipts[0].result.expectOk().expectBool(true);
    votingBlock.receipts[1].result.expectOk().expectBool(true);
    votingBlock.receipts[2].result.expectErr().expectUint(CCIP022TreasuryRedemptionNYC.ErrCode.ERR_USER_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccip-022: vote-on-proposal() fails with ERR_PROPOSAL_NOT_ACTIVE if called after the vote ends",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // prepare for CCIP (sets up cities, tokens, and data)
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);
    constructBlock.receipts[0].result.expectOk().expectBool(true);

    // mine to put funds in the mining treasury
    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, nyc.cityName, miningEntries), ccd006CityMiningV2.mine(user2, nyc.cityName, miningEntries)]);
    for (let i = 0; i < miningBlock.receipts.length; i++) {
      miningBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user3, nyc.cityName, amountStacked, lockPeriod)]);
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // execute yes and no vote
    // user 1 and 2 vote yes
    // user 3 votes no
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user2, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user3, false)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // execute ccip-022, ending the vote
    passProposal(chain, accounts, PROPOSALS.CCIP_022);

    // act
    // user 1 tries to reverse their vote
    const votingBlockAfter = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, false)]);

    // assert
    votingBlockAfter.receipts[0].result.expectErr().expectUint(CCIP022TreasuryRedemptionNYC.ErrCode.ERR_PROPOSAL_NOT_ACTIVE);
  },
});

Clarinet.test({
  name: "ccip-022: vote-on-proposal() fails with ERR_VOTED_ALREADY if user already voted with the same value",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // prepare for CCIP (sets up cities, tokens, and data)
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);
    constructBlock.receipts[0].result.expectOk().expectBool(true);

    // mine to put funds in the mining treasury
    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, nyc.cityName, miningEntries), ccd006CityMiningV2.mine(user2, nyc.cityName, miningEntries)]);
    for (let i = 0; i < miningBlock.receipts.length; i++) {
      miningBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked / 2, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked / 2, lockPeriod)]);
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // vote yes
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true)]);
    votingBlock.receipts[0].result.expectOk().expectBool(true);

    // act
    const votingBlockDupe = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true)]);

    // assert
    votingBlockDupe.receipts[0].result.expectErr().expectUint(CCIP022TreasuryRedemptionNYC.ErrCode.ERR_VOTED_ALREADY);
  },
});

Clarinet.test({
  name: "ccip-022: read-only functions return expected values before/after reversal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip022TreasuryRedemptionNyc = new CCIP022TreasuryRedemptionNYC(chain, sender);

    const blocksMined = 10;
    const amountPerBlock = 25000000;
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // prepare for CCIP (sets up cities, tokens, and data)
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP022_TREASURY_REDEMPTION_NYC_001);
    constructBlock.receipts[0].result.expectOk().expectBool(true);

    // mine to put some funds in the treasury
    const miningEntries = Array.from({ length: blocksMined }, () => amountPerBlock);
    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, nyc.cityName, miningEntries)]);

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

    // blocks to claim is an array of block heights
    // starting with the miningBlock height
    // and ending after blocksMined blocks
    const blocksToClaim = Array.from({ length: blocksMined }, (_, i) => miningBlock.height + i - 1);

    // claim mined blocks to increase total supply
    const claimBlock = chain.mineBlock(blocksToClaim.map((height) => ccd006CityMiningV2.claimMiningReward(user1, nyc.cityName, height)));
    for (let i = 0; i < claimBlock.receipts.length; i++) {
      claimBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // act

    // execute two yes votes, one no vote
    const votingBlock = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user1, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user2, true), ccip022TreasuryRedemptionNyc.voteOnProposal(user3, false)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // double check voting data
    // console.log("BEFORE REVERSAL");
    // console.log(`voting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    // printVotingData(ccd007CityStacking, ccip022TreasuryRedemptionNyc);

    // vote totals NYC
    ccip022TreasuryRedemptionNyc
      .getVoteTotalNyc()
      .result.expectSome()
      .expectTuple({ totalAmountNo: types.uint(0), totalAmountYes: types.uint(1500), totalVotesNo: types.uint(0), totalVotesYes: types.uint(3) });

    // vote totals in contract (MIA+NYC+Totals)
    ccip022TreasuryRedemptionNyc
      .getVoteTotals()
      .result.expectSome()
      .expectTuple({ nyc: { totalAmountNo: types.uint(0), totalAmountYes: types.uint(1500), totalVotesNo: types.uint(0), totalVotesYes: types.uint(3) }, totals: { totalAmountNo: types.uint(0), totalAmountYes: types.uint(2835), totalVotesNo: types.uint(0), totalVotesYes: types.uint(6) } });

    // user 1 stats
    ccip022TreasuryRedemptionNyc
      .getVoterInfo(1)
      .result.expectSome()
      .expectTuple({ nyc: types.uint(500), vote: types.bool(true) });
    ccd007CityStacking.getStacker(nyc.cityId, 2, 1).result.expectTuple({ claimable: types.uint(0), stacked: types.uint(500) });
    ccip022TreasuryRedemptionNyc.getNycVote(1, false).result.expectSome().expectUint(500);

    // user 2 stats
    ccip022TreasuryRedemptionNyc
      .getVoterInfo(2)
      .result.expectSome()
      .expectTuple({ nyc: types.uint(500), vote: types.bool(true) });
    ccd007CityStacking.getStacker(nyc.cityId, 2, 2).result.expectTuple({ claimable: types.uint(0), stacked: types.uint(500) });
    ccip022TreasuryRedemptionNyc.getNycVote(2, false).result.expectSome().expectUint(500);

    // user 3 stats
    ccip022TreasuryRedemptionNyc
      .getVoterInfo(3)
      .result.expectSome()
      .expectTuple({ nyc: types.uint(500), vote: types.bool(false) });
    ccd007CityStacking.getStacker(nyc.cityId, 2, 3).result.expectTuple({ claimable: types.uint(0), stacked: types.uint(500) });
    ccip022TreasuryRedemptionNyc.getNycVote(3, false).result.expectSome().expectUint(500);

    // reverse the vote for user 3
    const votingBlockReversed = chain.mineBlock([ccip022TreasuryRedemptionNyc.voteOnProposal(user3, true)]);
    votingBlockReversed.receipts[0].result.expectOk().expectBool(true);

    // vote totals NYC
    ccip022TreasuryRedemptionNyc
      .getVoteTotalNyc()
      .result.expectSome()
      .expectTuple({ totalAmountNo: types.uint(0), totalAmountYes: types.uint(1500), totalVotesNo: types.uint(0), totalVotesYes: types.uint(3) });
    // vote totals in contract (MIA+NYC+Totals)
    ccip022TreasuryRedemptionNyc
      .getVoteTotals()
      .result.expectSome()
      .expectTuple({ nyc: { totalAmountNo: types.uint(0), totalAmountYes: types.uint(1500), totalVotesNo: types.uint(0), totalVotesYes: types.uint(3) }, totals: { totalAmountNo: types.uint(0), totalAmountYes: types.uint(2835), totalVotesNo: types.uint(0), totalVotesYes: types.uint(6) } });

    // user 1 stats
    ccip022TreasuryRedemptionNyc
      .getVoterInfo(1)
      .result.expectSome()
      .expectTuple({ nyc: types.uint(500), vote: types.bool(true) });
    ccd007CityStacking.getStacker(nyc.cityId, 2, 1).result.expectTuple({ claimable: types.uint(0), stacked: types.uint(500) });
    ccip022TreasuryRedemptionNyc.getNycVote(1, false).result.expectSome().expectUint(500);

    // user 2 stats
    ccip022TreasuryRedemptionNyc
      .getVoterInfo(2)
      .result.expectSome()
      .expectTuple({ nyc: types.uint(500), vote: types.bool(true) });
    ccd007CityStacking.getStacker(nyc.cityId, 2, 2).result.expectTuple({ claimable: types.uint(0), stacked: types.uint(500) });
    ccip022TreasuryRedemptionNyc.getNycVote(2, false).result.expectSome().expectUint(500);

    // user 3 stats
    ccip022TreasuryRedemptionNyc
      .getVoterInfo(3)
      .result.expectSome()
      .expectTuple({ nyc: types.uint(500), vote: types.bool(true) });
    ccd007CityStacking.getStacker(nyc.cityId, 2, 3).result.expectTuple({ claimable: types.uint(0), stacked: types.uint(500) });
    ccip022TreasuryRedemptionNyc.getNycVote(3, false).result.expectSome().expectUint(500);

    // double check voting data
    //console.log("AFTER REVERSAL");
    //console.log(`voting block reversed:\n${JSON.stringify(votingBlockReversed, null, 2)}`);
    //printVotingData(ccd007CityStacking, ccip022TreasuryRedemptionNyc);

    // execute ccip-022
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_022);

    // assert
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

/*
Clarinet.test({
  name: "",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // act

    // assert
  }
})
*/
