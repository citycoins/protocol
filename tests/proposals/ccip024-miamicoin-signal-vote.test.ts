import { Account, Clarinet, Chain, types } from "../../utils/deps.ts";
import { constructAndPassProposal, PROPOSALS, mia } from "../../utils/common.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCIP024MiamiCoinSignalVote } from "../../models/proposals/ccip024-miamicoin-signal-vote.model.ts";

Clarinet.test({
  name: "ccip-024: vote-on-proposal() succeeds for eligible voters",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip024 = new CCIP024MiamiCoinSignalVote(chain, sender);

    // Initialize contracts and stack
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP024_MIAMICOIN_SIGNAL_VOTE_001);
    chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, 500, 10)]);
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);

    // Act & Assert
    const receipt = chain.mineBlock([ccip024.voteOnProposal(user1, true)]).receipts[0];
    receipt.result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccip-024: vote-on-proposal() fails for ineligible voters",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccip024 = new CCIP024MiamiCoinSignalVote(chain, sender);

    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP024_MIAMICOIN_SIGNAL_VOTE_001);

    const receipt = chain.mineBlock([ccip024.voteOnProposal(user1, true)]).receipts[0];
    receipt.result.expectErr().expectUint(CCIP024MiamiCoinSignalVote.ErrCode.ERR_USER_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccip-024: vote-on-proposal() fails after voting period ends",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip024 = new CCIP024MiamiCoinSignalVote(chain, sender);

    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP024_MIAMICOIN_SIGNAL_VOTE_001);
    chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, 500, 10)]);
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 7 + 10);

    const receipt = chain.mineBlock([ccip024.voteOnProposal(user1, true)]).receipts[0];
    receipt.result.expectErr().expectUint(CCIP024MiamiCoinSignalVote.ErrCode.ERR_PROPOSAL_NOT_ACTIVE);
  },
});

Clarinet.test({
  name: "ccip-024: read-only functions return expected values",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const ccip024 = new CCIP024MiamiCoinSignalVote(chain, sender);

    // Setup
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP024_MIAMICOIN_SIGNAL_VOTE_001);
    chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, 500, 10), ccd007CityStacking.stack(user2, mia.cityName, 300, 10)]);
    chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 6 + 10);

    // Vote
    chain.mineBlock([ccip024.voteOnProposal(user1, true), ccip024.voteOnProposal(user2, false)]);

    // Assert
    ccip024
      .getVoteTotalMia()
      .result.expectSome()
      .expectTuple({
        totalAmountYes: types.uint(500),
        totalAmountNo: types.uint(300),
        totalVotesYes: types.uint(1),
        totalVotesNo: types.uint(1),
      });

    ccip024
      .getVoterInfo(1)
      .result.expectSome()
      .expectTuple({
        vote: types.bool(true),
        mia: types.uint(500),
      });

    ccip024.isVoteActive().result.expectSome().expectBool(true);

    const voteInfo = ccip024.getVotePeriod().result.expectSome().expectTuple();
    voteInfo.length.expectUint(2016);
  },
});

Clarinet.test({
  name: "ccip-024: execute() and is-executable() always succeed",
  fn(chain: Chain, accounts: Map<string, Account>) {
    const sender = accounts.get("deployer")!;
    const ccip024 = new CCIP024MiamiCoinSignalVote(chain, sender);

    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCIP024_MIAMICOIN_SIGNAL_VOTE_001);

    ccip024.isExecutable().result.expectOk().expectBool(true);

    const receipt = chain.mineBlock([ccip024.execute(sender)]).receipts[0];
    receipt.result.expectOk().expectBool(true);
  },
});
