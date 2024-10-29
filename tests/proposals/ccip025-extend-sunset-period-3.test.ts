import { Account, Clarinet, Chain, types, assertEquals } from "../../utils/deps.ts";
import { constructAndPassProposal, mia, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCIP025ExtendDirectExecuteSunsetPeriod } from "../../models/proposals/ccip025-extend-sunset-period-3.model.ts";

Clarinet.test({
  name: "ccip-025: execute() fails with ERR_VOTE_FAILED if there are no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP025_EXTEND_SUNSET_PERIOD_3_001);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, mia.cityName, amountStacked / 2, lockPeriod)]);
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
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_025);

    // assert
    block.receipts[0].result.expectOk().expectUint(1);
    block.receipts[1].result.expectOk().expectUint(2);
    block.receipts[2].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-025: execute() fails with ERR_VOTE_FAILED if there are more no than yes votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP025_EXTEND_SUNSET_PERIOD_3_001);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, mia.cityName, amountStacked / 2, lockPeriod)]);
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
    const votingBlock = chain.mineBlock([ccip025.voteOnProposal(user1, false), ccip025.voteOnProposal(user2, false)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // execute ccip-025
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_025);

    // assert
    block.receipts[0].result.expectOk().expectUint(1);
    block.receipts[1].result.expectOk().expectUint(2);
    block.receipts[2].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-025: execute() succeeds if there is a single yes vote",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP025_EXTEND_SUNSET_PERIOD_3_001);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod)]);
    // make sure every transaction succeeded
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // act
    // execute single yes vote
    const votingBlock = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);
    for (let i = 0; i < votingBlock.receipts.length; i++) {
      votingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // execute ccip-025
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_025);

    const voteTotals = ccip025.getVoteTotals().result.expectSome().expectTuple();

    // assert
    block.receipts[0].result.expectOk().expectUint(1);
    block.receipts[1].result.expectOk().expectUint(2);
    block.receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccip-025: vote-on-proposal() fails with ERR_USER_NOT_FOUND if user is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user3 = accounts.get("wallet_3")!;
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    // act
    const block = chain.mineBlock([ccip025.voteOnProposal(user3, true)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_USER_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccip-025: vote-on-proposal() fails with ERR_NOTHING_STACKED if user has no stacking history",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    // register user but don't stack
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);

    // act
    const block = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_NOTHING_STACKED);
  },
});

Clarinet.test({
  name: "ccip-025: vote-on-proposal() fails with ERR_VOTED_ALREADY if user votes same way twice",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP025_EXTEND_SUNSET_PERIOD_3_001);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod)]);
    // make sure every transaction succeeded
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // first vote
    const firstVote = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);
    for (let i = 0; i < firstVote.receipts.length; i++) {
      firstVote.receipts[i].result.expectOk().expectBool(true);
    }

    // act
    const block = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTED_ALREADY);
  },
});

Clarinet.test({
  name: "ccip-025: vote-on-proposal() fails with ERR_PROPOSAL_NOT_ACTIVE after execution",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP025_EXTEND_SUNSET_PERIOD_3_001);

    // stack first cycle u1
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod)]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // vote and execute proposal
    const voteBlock = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);
    voteBlock.receipts[0].result.expectOk().expectBool(true);

    const executeBlock = passProposal(chain, accounts, PROPOSALS.CCIP_025);
    executeBlock.receipts[0].result.expectOk().expectUint(1);
    executeBlock.receipts[1].result.expectOk().expectUint(2);
    executeBlock.receipts[2].result.expectOk().expectUint(3);

    // act
    const block = chain.mineBlock([ccip025.voteOnProposal(user1, false)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_PROPOSAL_NOT_ACTIVE);
  },
});

Clarinet.test({
  name: "ccip-025: read-only functions return expected values",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);

    // initialize contracts
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP025_EXTEND_SUNSET_PERIOD_3_001);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod)]);
    // make sure every transaction succeeded
    for (let i = 0; i < stackingBlock.receipts.length; i++) {
      stackingBlock.receipts[i].result.expectOk().expectBool(true);
    }

    // progress the chain to cycle 5
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(5);

    // act
    const voteBlock = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);
    for (let i = 0; i < voteBlock.receipts.length; i++) {
      voteBlock.receipts[i].result.expectOk().expectBool(true);
    }

    const executeBlock = passProposal(chain, accounts, PROPOSALS.CCIP_025);
    executeBlock.receipts[0].result.expectOk().expectUint(1);
    executeBlock.receipts[1].result.expectOk().expectUint(2);
    executeBlock.receipts[2].result.expectOk().expectUint(3);

    // assert
    ccip025.isVoteActive().result.expectBool(false);

    const proposalInfo = {
      name: types.ascii("Extend Direct Execute Sunset Period 3"),
      link: types.ascii("https://github.com/citycoins/governance/blob/feat/add-ccip-025/ccips/ccip-025/ccip-025-extend-direct-execute-sunset-period-3.md"),
      hash: types.ascii("TBD"),
    };
    assertEquals(ccip025.getProposalInfo().result.expectSome().expectTuple(), proposalInfo);

    const votePeriod = ccip025.getVotePeriod().result.expectSome().expectTuple();
    assertEquals(votePeriod.startBlock, types.uint(8));
    assertEquals(votePeriod.endBlock, types.uint(executeBlock.height - 1));

    const voteTotals = ccip025.getVoteTotals().result.expectSome().expectTuple();
    const totals = voteTotals.totals.expectTuple();
    assertEquals(totals.totalAmountYes, types.uint(amountStacked));
    assertEquals(totals.totalVotesYes, types.uint(1));
    assertEquals(totals.totalAmountNo, types.uint(0));
    assertEquals(totals.totalVotesNo, types.uint(0));
  },
});
