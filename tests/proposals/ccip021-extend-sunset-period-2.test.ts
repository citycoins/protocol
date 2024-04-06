import { Account, Clarinet, Chain, types, assertEquals } from "../../utils/deps.ts";
import { constructAndPassProposal, mia, nyc, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD006CityMining } from "../../models/extensions/ccd006-citycoin-mining.model.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCIP021ExtendDirectExecuteSunsetPeriod } from "../../models/proposals/ccip021-extend-direct-execute-sunset-period.model.ts";

const TARGET_SUNSET_BLOCK = 147828;

Clarinet.test({
  name: "ccip-021: execute() fails with ERR_VOTE_FAILED if there are no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // register MIA and NYC
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set activation details for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set activation status for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // act

    // execute ccip-021
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_021);

    // assert
    block.receipts[2].result.expectErr().expectUint(CCIP021ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-021: execute() fails with ERR_VOTE_FAILED if there are more no than yes votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip021ExtendDirectExecuteSunsetPeriod = new CCIP021ExtendDirectExecuteSunsetPeriod(chain, sender);

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

    // execute two no votes
    const votingBlock = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, false), ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user2, false)]);

    /* double check voting data
    console.log(`voting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    console.log("user 1:");
    console.log(ccd007CityStacking.getStacker(mia.cityId, 2, 1));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(1));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, 1, false));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, 1, true));
    console.log("user 2:");
    console.log(ccd007CityStacking.getStacker(mia.cityId, 2, 2));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(2));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, 2, false));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, 2, true));
    */

    // execute ccip-021
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_021);

    // assert
    block.receipts[2].result.expectErr().expectUint(CCIP021ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-021: execute() succeeds if there is a single yes vote",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip021ExtendDirectExecuteSunsetPeriod = new CCIP021ExtendDirectExecuteSunsetPeriod(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // prepare for ccip-021
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
    const votingBlock = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, true)]);

    /* double check voting data
    const cycleId = 2;
    const userId = 2;
    console.log(`\nconstruct block:\n${JSON.stringify(constructBlock, null, 2)}`);
    console.log(`\nmining block:\n${JSON.stringify(miningBlock, null, 2)}`);
    console.log(`\nstacking block:\n${JSON.stringify(stackingBlock, null, 2)}`);
    console.log(`\nvoting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    console.log("\nuser 1 mia:");
    console.log(ccd007CityStacking.getStacker(mia.cityId, cycleId, userId));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(userId));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, userId, false));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, userId, true));
    console.log("\nuser 1 nyc:");
    console.log(ccd007CityStacking.getStacker(nyc.cityId, cycleId, userId));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(userId));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getNycVote(nyc.cityId, userId, false));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getNycVote(nyc.cityId, userId, true));
    */

    // check vote is active
    ccip021ExtendDirectExecuteSunsetPeriod.isVoteActive().result.expectSome().expectBool(true);
    // check proposal info
    const proposalInfo = {
      hash: types.ascii("7ddbf6152790a730faa059b564a8524abc3c70d3"),
      link: types.ascii("https://github.com/citycoins/governance/blob/feat/add-ccip-021/ccips/ccip-021/ccip-021-extend-direct-execute-sunset-period.md"),
      name: types.ascii("Extend Direct Execute Sunset Period"),
    };
    assertEquals(ccip021ExtendDirectExecuteSunsetPeriod.getProposalInfo().result.expectSome().expectTuple(), proposalInfo);
    // check vote period is not set (end unknown)
    ccip021ExtendDirectExecuteSunsetPeriod.getVotePeriod().result.expectNone();

    // execute ccip-021
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_021);

    // assert
    // check vote period is set and returns
    const start = constructBlock.height - CCD007CityStacking.FIRST_STACKING_BLOCK - 1;
    const end = votingBlock.height;
    const votingPeriod = {
      startBlock: types.uint(start),
      endBlock: types.uint(end),
      length: types.uint(end - start),
    };
    assertEquals(ccip021ExtendDirectExecuteSunsetPeriod.getVotePeriod().result.expectSome().expectTuple(), votingPeriod);
    // check vote is no longer active
    ccip021ExtendDirectExecuteSunsetPeriod.isVoteActive().result.expectSome().expectBool(false);
    //console.log(`\nexecute block:\n${JSON.stringify(block, null, 2)}`);
    // check that proposal executed
    block.receipts[2].result.expectOk().expectUint(3);
    // check for print event in execute block
    const ccip021PrintEvent = `{event: ${types.ascii("set-sunset-block")}, height: ${types.uint(TARGET_SUNSET_BLOCK)}}`;
    assertEquals(block.receipts[2].events[1].contract_event.value, ccip021PrintEvent);
  },
});

Clarinet.test({
  name: "ccip-021: execute() succeeds if there are more yes than no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip021ExtendDirectExecuteSunsetPeriod = new CCIP021ExtendDirectExecuteSunsetPeriod(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // prepare for ccip-021
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
    const votingBlock = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, true), ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user2, false)]);

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
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(user1Id));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, user1Id, false));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, user1Id, true));
    console.log("\nuser 1 nyc:");
    console.log(ccd007CityStacking.getStacker(nyc.cityId, cycleId, user1Id));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(user1Id));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getNycVote(nyc.cityId, user1Id, false));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getNycVote(nyc.cityId, user1Id, true));
    console.log("\nuser 2 mia:");
    console.log(ccd007CityStacking.getStacker(mia.cityId, cycleId, user2Id));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(user2Id));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, user2Id, false));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getMiaVote(mia.cityId, user2Id, true));
    console.log("\nuser 2 nyc:");
    console.log(ccd007CityStacking.getStacker(nyc.cityId, cycleId, user2Id));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(user2Id));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getNycVote(nyc.cityId, user2Id, false));
    console.log(ccip021ExtendDirectExecuteSunsetPeriod.getNycVote(nyc.cityId, user2Id, true));
    */

    // execute ccip-021
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_021);

    // assert
    //console.log(`\nexecute block:\n${JSON.stringify(block, null, 2)}`);
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-021: execute() succeeds if there are more yes than no votes after a reversal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip021ExtendDirectExecuteSunsetPeriod = new CCIP021ExtendDirectExecuteSunsetPeriod(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // prepare for ccip-021
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
    const votingBlock = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, false), ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user2, true)]);

    // switch yes and no vote
    const votingBlockReverse = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, true), ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user2, false)]);

    /* double check voting data
    console.log(`\nvoting block:\n${JSON.stringify(votingBlock, null, 2)}`);
    console.log(`\nvoting block reverse:\n${JSON.stringify(votingBlockReverse, null, 2)}`);
    */

    // execute ccip-021
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_021);

    // assert
    //console.log(`\nexecute block:\n${JSON.stringify(block, null, 2)}`);
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-021: vote-on-proposal() fails with ERR_USER_NOT_FOUND if user is not registered in ccd003-user-registry",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip021ExtendDirectExecuteSunsetPeriod = new CCIP021ExtendDirectExecuteSunsetPeriod(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // prepare for ccip-021
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
    const votingBlock = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user3, true)]);

    // assert
    //console.log(`votingBlock: ${JSON.stringify(votingBlock, null, 2)}`);
    votingBlock.receipts[0].result.expectErr().expectUint(CCIP021ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_USER_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccip-021: vote-on-proposal() fails with ERR_PROPOSAL_NOT_ACTIVE if called after the vote ends",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip021ExtendDirectExecuteSunsetPeriod = new CCIP021ExtendDirectExecuteSunsetPeriod(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // prepare for ccip-021
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

    // execute yes and no vote
    // user 1 has more voting power
    const votingBlock = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, true), ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user2, false)]);

    // execute ccip-021
    passProposal(chain, accounts, PROPOSALS.CCIP_021);

    // act
    const votingBlock2 = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, true)]);

    // assert
    votingBlock2.receipts[0].result.expectErr().expectUint(CCIP021ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_PROPOSAL_NOT_ACTIVE);
  },
});

Clarinet.test({
  name: "ccip-021: vote-on-proposal() fails with ERR_VOTED_ALREADY if user already voted with the same value",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip021ExtendDirectExecuteSunsetPeriod = new CCIP021ExtendDirectExecuteSunsetPeriod(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // prepare for ccip-021
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

    // execute yes and no vote
    // user 1 has more voting power
    const votingBlock = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, true), ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user2, false)]);

    // act
    const votingBlock2 = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, true)]);

    // assert
    votingBlock2.receipts[0].result.expectErr().expectUint(CCIP021ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTED_ALREADY);
  },
});

Clarinet.test({
  name: "ccip-021: read-only functions return expected values before/after reversal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining");
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip021ExtendDirectExecuteSunsetPeriod = new CCIP021ExtendDirectExecuteSunsetPeriod(chain, sender);

    const miningEntries = [25000000, 25000000];
    const amountStacked = 500;
    const lockPeriod = 10;

    const cycleId = 2;
    const user1Id = 2;
    const user2Id = 3;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // prepare for ccip-021
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
    const votingBlock = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, false), ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user2, true)]);

    // assert

    // overall totals
    assertEquals(ccip021ExtendDirectExecuteSunsetPeriod.getVoteTotals().result.expectSome().expectTuple(), {
      noTotal: types.uint(941),
      noVotes: types.uint(1),
      yesTotal: types.uint(470),
      yesVotes: types.uint(1),
    });

    // user 1

    assertEquals(ccd007CityStacking.getStacker(mia.cityId, cycleId, user1Id).result.expectTuple(), {
      claimable: types.uint(0),
      stacked: types.uint(500),
    });
    assertEquals(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(user1Id).result.expectSome().expectTuple(), {
      mia: types.uint(441),
      nyc: types.uint(500),
      total: types.uint(941),
      vote: types.bool(false),
    });

    // user 2
    assertEquals(ccd007CityStacking.getStacker(mia.cityId, cycleId, user2Id).result.expectTuple(), {
      claimable: types.uint(0),
      stacked: types.uint(250),
    });
    assertEquals(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(user2Id).result.expectSome().expectTuple(), {
      mia: types.uint(220),
      nyc: types.uint(250),
      total: types.uint(470),
      vote: types.bool(true),
    });

    // act

    // switch yes and no vote
    const votingBlockReverse = chain.mineBlock([ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user1, true), ccip021ExtendDirectExecuteSunsetPeriod.voteOnProposal(user2, false)]);

    // assert

    // overall totals
    assertEquals(ccip021ExtendDirectExecuteSunsetPeriod.getVoteTotals().result.expectSome().expectTuple(), {
      noTotal: types.uint(470),
      noVotes: types.uint(1),
      yesTotal: types.uint(941),
      yesVotes: types.uint(1),
    });
    // user 1
    assertEquals(ccd007CityStacking.getStacker(mia.cityId, cycleId, user1Id).result.expectTuple(), {
      claimable: types.uint(0),
      stacked: types.uint(500),
    });
    assertEquals(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(user1Id).result.expectSome().expectTuple(), {
      mia: types.uint(441),
      nyc: types.uint(500),
      total: types.uint(941),
      vote: types.bool(true),
    });
    // user 2
    assertEquals(ccd007CityStacking.getStacker(mia.cityId, cycleId, user2Id).result.expectTuple(), {
      claimable: types.uint(0),
      stacked: types.uint(250),
    });
    assertEquals(ccip021ExtendDirectExecuteSunsetPeriod.getVoterInfo(user2Id).result.expectSome().expectTuple(), {
      mia: types.uint(220),
      nyc: types.uint(250),
      total: types.uint(470),
      vote: types.bool(false),
    });

    // execute ccip-021
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_021);

    // assert
    block.receipts[2].result.expectOk().expectUint(3);
  },
});
