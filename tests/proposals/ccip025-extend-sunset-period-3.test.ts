import { Account, Clarinet, Chain, types, assertEquals } from "../../utils/deps.ts";
import { constructAndPassProposal, mia, PROPOSALS } from "../../utils/common.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCIP025ExtendDirectExecuteSunsetPeriod } from "../../models/proposals/ccip025-extend-sunset-period-3.model.ts";

Clarinet.test({
  name: "ccip-025: execute() fails with ERR_VOTE_FAILED if there are no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    // act
    const block = chain.mineBlock([ccip025.execute(sender)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTE_FAILED);
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

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([
      ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod),
      ccd007CityStacking.stack(user2, mia.cityName, amountStacked / 2, lockPeriod)
    ]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);

    // act
    // execute two no votes
    chain.mineBlock([
      ccip025.voteOnProposal(user1, false),
      ccip025.voteOnProposal(user2, false)
    ]);

    // execute ccip-025
    const block = chain.mineBlock([ccip025.execute(sender)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTE_FAILED);
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

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([
      ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod)
    ]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);

    // progress the chain to cycle 5
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);

    // act
    // execute single yes vote
    const votingBlock = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);

    // execute ccip-025
    const block = chain.mineBlock([ccip025.execute(sender)]);

    // assert
    block.receipts[0].result.expectOk().expectBool(true);
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

    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod)]);
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);

    // first vote
    chain.mineBlock([ccip025.voteOnProposal(user1, true)]);

    // act
    const block = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCIP025ExtendDirectExecuteSunsetPeriod.ErrCode.ERR_VOTED_ALREADY);
  },
});

Clarinet.test({
  name: "ccip-025: read-only functions return expected values",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip025 = new CCIP025ExtendDirectExecuteSunsetPeriod(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    
    // stack and progress chain
    chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod)]);
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);

    // act
    const voteBlock = chain.mineBlock([ccip025.voteOnProposal(user1, true)]);
    const executeBlock = chain.mineBlock([ccip025.execute(sender)]);

    // assert
    ccip025.isVoteActive().result.expectBool(false);
    
    const proposalInfo = {
      name: types.ascii("Extend Direct Execute Sunset Period 3"),
      link: types.ascii("https://github.com/citycoins/governance/blob/feat/add-ccip-025/ccips/ccip-025/ccip-025-extend-direct-execute-sunset-period-3.md"),
      hash: types.ascii("TBD"),
    };
    assertEquals(ccip025.getProposalInfo().result.expectSome().expectTuple(), proposalInfo);

    const votePeriod = ccip025.getVotePeriod().result.expectSome().expectTuple();
    assertEquals(votePeriod.startBlock, types.uint(0));
    assertEquals(votePeriod.endBlock, types.uint(executeBlock.height));

    const voteTotals = ccip025.getVoteTotals().result.expectSome().expectTuple();
    assertEquals(voteTotals.totals.totalAmountYes, types.uint(amountStacked));
    assertEquals(voteTotals.totals.totalVotesYes, types.uint(1));
    assertEquals(voteTotals.totals.totalAmountNo, types.uint(0));
    assertEquals(voteTotals.totals.totalVotesNo, types.uint(0));
  },
});
