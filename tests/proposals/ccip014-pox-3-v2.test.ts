import { Account, Clarinet, Chain, types, assertEquals } from "../../utils/deps.ts";
import { CCD006_REWARD_DELAY, constructAndPassProposal, mia, nyc, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD006CityMining } from "../../models/extensions/ccd006-citycoin-mining.model.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCIP014Pox3 } from "../../models/proposals/ccip014-pox-3.model.ts";
import { CCIP014Pox3v2 } from "../../models/proposals/ccip014-pox-3-v2.model.ts";

Clarinet.test({
  name: "ccip-014: execute() fails with ERR_VOTE_FAILED if there are no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // register MIA and NYC
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set activation details for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set activation status for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // act

    // execute ccip-014-v2
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_014_V2);

    // assert
    block.receipts[2].result.expectErr().expectUint(CCIP014Pox3v2.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-014: execute() fails with ERR_VOTE_FAILED if there are more no than yes votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip014pox = new CCIP014Pox3(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // register MIA and NYC
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set activation details for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set activation status for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add stacking treasury in city data
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, mia.cityName, amountStacked, lockPeriod)]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);
    stackingBlock.receipts[1].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // act

    // execute two no votes in v1
    const votingBlock = chain.mineBlock([ccip014pox.voteOnProposal(user1, false), ccip014pox.voteOnProposal(user2, false)]);

    // execute ccip-014-v2
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_014_V2);

    // assert
    block.receipts[2].result.expectErr().expectUint(CCIP014Pox3v2.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-014: execute() succeeds if there is a single yes vote",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip014pox = new CCIP014Pox3(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // prepare for CCIP-014
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP014_POX3_001);

    // mine to put funds in the mining treasury
    const miningBlock = chain.mineBlock([ccd006CityMining.mine(sender, mia.cityName, miningEntries), ccd006CityMining.mine(sender, nyc.cityName, miningEntries)]);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod)]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // act

    // execute single yes vote
    const votingBlock = chain.mineBlock([ccip014pox.voteOnProposal(user1, true)]);

    /* double check voting data
    const cycleId = 2;
    const userId = 2;
    console.log(`\nconstruct block:\n${JSON.stringify(constructBlock, null, 2)}`);
    console.log(`\nmining block:\n${JSON.stringify(miningBlock, null, 2)}`);
    console.log(`\nstacking block:\n${JSON.stringify(stackingBlock, null, 2)}`);
    console.log(`\nvoting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    console.log("\nuser 1 mia:");
    console.log(ccd007CityStacking.getStacker(mia.cityId, cycleId, userId));
    console.log(ccip014pox3v2.getVoterInfo(userId));
    console.log(ccip014pox3v2.getMiaVote(mia.cityId, userId, false));
    console.log(ccip014pox3v2.getMiaVote(mia.cityId, userId, true));
    console.log("\nuser 1 nyc:");
    console.log(ccd007CityStacking.getStacker(nyc.cityId, cycleId, userId));
    console.log(ccip014pox3v2.getVoterInfo(userId));
    console.log(ccip014pox3v2.getNycVote(nyc.cityId, userId, false));
    console.log(ccip014pox3v2.getNycVote(nyc.cityId, userId, true));
    */

    // execute ccip-014-v2
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_014_V2);

    // assert
    //console.log(`\nexecute block:\n${JSON.stringify(block, null, 2)}`);
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-014: execute() succeeds if there are more yes than no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip014pox = new CCIP014Pox3(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // prepare for CCIP-014
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP014_POX3_001);

    // mine to put funds in the mining treasury
    const miningBlock = chain.mineBlock([ccd006CityMining.mine(sender, mia.cityName, miningEntries), ccd006CityMining.mine(sender, nyc.cityName, miningEntries)]);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, mia.cityName, amountStacked / 2, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked / 2, lockPeriod)]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // act

    // execute yes and no vote
    // user 1 has more voting power
    const votingBlock = chain.mineBlock([ccip014pox.voteOnProposal(user1, true), ccip014pox.voteOnProposal(user2, false)]);

    /* double check voting data
    const cycleId = 2;
    const user1Id = 2;
    const user2Id = 3;
    console.log(`\nconstruct block:\n${JSON.stringify(constructBlock, null, 2)}`);
    console.log(`\nmining block:\n${JSON.stringify(miningBlock, null, 2)}`);
    console.log(`\nstacking block:\n${JSON.stringify(stackingBlock, null, 2)}`);
    console.log(`\nvoting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    console.log("\nuser 1 mia:");
    console.log(ccd007CityStacking.getStacker(mia.cityId, cycleId, user1Id));
    console.log(ccip014pox3v2.getVoterInfo(user1Id));
    console.log(ccip014pox3v2.getMiaVote(mia.cityId, user1Id, false));
    console.log(ccip014pox3v2.getMiaVote(mia.cityId, user1Id, true));
    console.log("\nuser 1 nyc:");
    console.log(ccd007CityStacking.getStacker(nyc.cityId, cycleId, user1Id));
    console.log(ccip014pox3v2.getVoterInfo(user1Id));
    console.log(ccip014pox3v2.getNycVote(nyc.cityId, user1Id, false));
    console.log(ccip014pox3v2.getNycVote(nyc.cityId, user1Id, true));
    console.log("\nuser 2 mia:");
    console.log(ccd007CityStacking.getStacker(mia.cityId, cycleId, user2Id));
    console.log(ccip014pox3v2.getVoterInfo(user2Id));
    console.log(ccip014pox3v2.getMiaVote(mia.cityId, user2Id, false));
    console.log(ccip014pox3v2.getMiaVote(mia.cityId, user2Id, true));
    console.log("\nuser 2 nyc:");
    console.log(ccd007CityStacking.getStacker(nyc.cityId, cycleId, user2Id));
    console.log(ccip014pox3v2.getVoterInfo(user2Id));
    console.log(ccip014pox3v2.getNycVote(nyc.cityId, user2Id, false));
    console.log(ccip014pox3v2.getNycVote(nyc.cityId, user2Id, true));
    */

    // execute ccip-014-v2
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_014_V2);

    // assert
    //console.log(`\nexecute block:\n${JSON.stringify(block, null, 2)}`);
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-014: execute() succeeds if there are more yes than no votes after a reversal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip014pox = new CCIP014Pox3(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // prepare for CCIP-014
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP014_POX3_001);

    // mine to put funds in the mining treasury
    const miningBlock = chain.mineBlock([ccd006CityMining.mine(sender, mia.cityName, miningEntries), ccd006CityMining.mine(sender, nyc.cityName, miningEntries)]);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, mia.cityName, amountStacked / 2, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked / 2, lockPeriod)]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // act

    // execute yes and no vote
    // user 1 has more voting power
    const votingBlock = chain.mineBlock([ccip014pox.voteOnProposal(user1, false), ccip014pox.voteOnProposal(user2, true)]);

    // switch yes and no vote
    const votingBlockReverse = chain.mineBlock([ccip014pox.voteOnProposal(user1, true), ccip014pox.voteOnProposal(user2, false)]);

    /* double check voting data
    console.log(`\nvoting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    console.log(`\nvoting block reverse:\n${JSON.stringify(votingBlockReverse, null, 2)}`);
    */

    // execute ccip-014-v2
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_014_V2);

    // assert
    //console.log(`\nexecute block:\n${JSON.stringify(block, null, 2)}`);
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-014: after upgrade mining disabled, mining-v2 enabled, mining and stacking claims work as expected",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip014pox = new CCIP014Pox3(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // prepare for CCIP-014
    const constructBlock = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP014_POX3_001);

    // mine to put funds in the mining treasury
    const miningBlockBefore = chain.mineBlock([ccd006CityMining.mine(sender, mia.cityName, miningEntries), ccd006CityMining.mine(sender, nyc.cityName, miningEntries)]);
    //console.log(`\nminingBlockBefore:\n${JSON.stringify(miningBlockBefore, null, 2)}`);
    miningBlockBefore.receipts[0].result.expectOk().expectBool(true);
    miningBlockBefore.receipts[1].result.expectOk().expectBool(true);

    // mine in v2 before the upgrade, fails with ERR_INVALID_TREASURY
    const miningBlockV2Before = chain.mineBlock([ccd006CityMiningV2.mine(sender, mia.cityName, miningEntries), ccd006CityMiningV2.mine(sender, nyc.cityName, miningEntries)]);
    miningBlockV2Before.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_TREASURY);
    miningBlockV2Before.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_TREASURY);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user1, nyc.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, nyc.cityName, amountStacked, lockPeriod)]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);
    stackingBlock.receipts[1].result.expectOk().expectBool(true);
    stackingBlock.receipts[2].result.expectOk().expectBool(true);
    stackingBlock.receipts[3].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    // votes are counted in cycles 2-3
    // past payouts tested for cycles 1-4
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // is-cycle-paid returns false for cycles 1-4 for MIA
    ccd007CityStacking.isCyclePaid(mia.cityId, 1).result.expectBool(false);
    ccd007CityStacking.isCyclePaid(mia.cityId, 2).result.expectBool(false);
    ccd007CityStacking.isCyclePaid(mia.cityId, 3).result.expectBool(false);
    ccd007CityStacking.isCyclePaid(mia.cityId, 4).result.expectBool(false);

    // is-cycle-paid returns false for cycles 1-4 for NYC
    ccd007CityStacking.isCyclePaid(nyc.cityId, 1).result.expectBool(false);
    ccd007CityStacking.isCyclePaid(nyc.cityId, 2).result.expectBool(false);
    ccd007CityStacking.isCyclePaid(nyc.cityId, 3).result.expectBool(false);
    ccd007CityStacking.isCyclePaid(nyc.cityId, 4).result.expectBool(false);

    // claim-stacking-reward before, fails with ERR_NOTHING_TO_CLAIM
    // since cycle is not paid out yet
    const claimStackingRewardBefore = chain.mineBlock([ccd007CityStacking.claimStackingReward(user1, mia.cityName, 2), ccd007CityStacking.claimStackingReward(user1, nyc.cityName, 2), ccd007CityStacking.claimStackingReward(user2, mia.cityName, 2), ccd007CityStacking.claimStackingReward(user2, nyc.cityName, 2)]);
    claimStackingRewardBefore.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
    claimStackingRewardBefore.receipts[1].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
    claimStackingRewardBefore.receipts[2].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);
    claimStackingRewardBefore.receipts[3].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_NOTHING_TO_CLAIM);

    // execute single yes vote
    const votingBlock = chain.mineBlock([ccip014pox.voteOnProposal(user1, true)]);
    votingBlock.receipts[0].result.expectOk().expectBool(true);

    // execute ccip-014-v2
    const executeBlock = passProposal(chain, accounts, PROPOSALS.CCIP_014_V2);
    executeBlock.receipts[2].result.expectOk().expectUint(3);

    /* double check voting data
    const cycleId = 2;
    const userId = 2;
    console.log(`\nconstruct block:\n${JSON.stringify(constructBlock, null, 2)}`);
    console.log(`\nmining block:\n${JSON.stringify(miningBlock, null, 2)}`);
    console.log(`\nstacking block:\n${JSON.stringify(stackingBlock, null, 2)}`);
    console.log(`\nvoting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    console.log("\nuser 1 mia:");
    console.log(ccd007CityStacking.getStacker(mia.cityId, cycleId, userId));
    console.log(ccip014pox3v2.getVoterInfo(userId));
    console.log(ccip014pox3v2.getMiaVote(mia.cityId, userId, false));
    console.log(ccip014pox3v2.getMiaVote(mia.cityId, userId, true));
    console.log("\nuser 1 nyc:");
    console.log(ccd007CityStacking.getStacker(nyc.cityId, cycleId, userId));
    console.log(ccip014pox3v2.getVoterInfo(userId));
    console.log(ccip014pox3v2.getNycVote(nyc.cityId, userId, false));
    console.log(ccip014pox3v2.getNycVote(nyc.cityId, userId, true));
    console.log(`\nexecute block:\n${JSON.stringify(block, null, 2)}`);
    */

    // act

    // mine in v1 after the upgrade, fails with ERR_MINING_DISABLED
    const miningBlockAfter = chain.mineBlock([ccd006CityMining.mine(sender, mia.cityName, miningEntries), ccd006CityMining.mine(sender, nyc.cityName, miningEntries)]);
    miningBlockAfter.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINING_DISABLED);
    miningBlockAfter.receipts[1].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINING_DISABLED);

    // mine in v2 after the upgrade
    const miningBlockV2After = chain.mineBlock([ccd006CityMiningV2.mine(sender, mia.cityName, miningEntries), ccd006CityMiningV2.mine(sender, nyc.cityName, miningEntries)]);
    //console.log(`\nminingBlockV2After:\n${JSON.stringify(miningBlockV2After, null, 2)}`);
    miningBlockV2After.receipts[0].result.expectOk().expectBool(true);
    miningBlockV2After.receipts[0].result.expectOk().expectBool(true);

    // fast forward so claims are valid
    chain.mineEmptyBlock(CCD006_REWARD_DELAY + 1);

    // pass proposal to set city info for claims
    passProposal(chain, accounts, PROPOSALS.TEST_CCIP014_POX3_002);

    const claimBlockHeight = miningBlockBefore.height - 1;
    const claimBlockHeightV2 = miningBlockV2After.height - 1;
    //console.log(`\nclaim block height: ${claimBlockHeight}`);
    //console.log(`\nclaim block height v2: ${claimBlockHeightV2}`);

    // test claim in v1 after upgrade
    const miningClaimAfter = chain.mineBlock([ccd006CityMining.claimMiningReward(sender, mia.cityName, claimBlockHeight)]);
    //console.log(`\nmining claim after:\n${JSON.stringify(miningClaimAfter, null, 2)}`);
    miningClaimAfter.receipts[0].result.expectOk().expectBool(true);

    // test claim in v2 after upgrade
    const miningClaimV2After = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(sender, mia.cityName, claimBlockHeightV2)]);
    //console.log(`\nmining claim v2 after:\n${JSON.stringify(miningClaimV2After, null, 2)}`);
    miningClaimV2After.receipts[0].result.expectOk().expectBool(true);
  },
});
