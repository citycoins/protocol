import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

enum ErrCode {
  ERR_PANIC = 2200,
  ERR_SAVING_VOTE,
  ERR_VOTED_ALREADY,
  ERR_NOTHING_STACKED,
  ERR_USER_NOT_FOUND,
  ERR_PROPOSAL_NOT_ACTIVE,
  ERR_PROPOSAL_STILL_ACTIVE,
  ERR_VOTE_FAILED,
}

export class CCIP022TreasuryRedemptionNYC {
  name = "ccip022-treasury-redemption-nyc";
  static readonly ErrCode = ErrCode;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  // public functions

  // execute() excluded since called by passProposal and CCD001

  voteOnProposal(sender: Account, vote: boolean) {
    return Tx.contractCall(this.name, "vote-on-proposal", [types.bool(vote)], sender.address);
  }

  // read-only functions

  isExecutable() {
    return this.callReadOnlyFn("is-executable");
  }

  isVoteActive() {
    return this.callReadOnlyFn("is-vote-active");
  }

  getProposalInfo() {
    return this.callReadOnlyFn("get-proposal-info");
  }

  getVotePeriod() {
    return this.callReadOnlyFn("get-vote-period");
  }

  getVoteTotalNyc() {
    return this.callReadOnlyFn("get-vote-total-nyc");
  }

  getVoteTotalNycOrDefault() {
    return this.callReadOnlyFn("get-vote-total-nyc-or-default");
  }

  getVoteTotals() {
    return this.callReadOnlyFn("get-vote-totals");
  }

  getVoterInfo(userId: number) {
    return this.callReadOnlyFn("get-voter-info", [types.uint(userId)]);
  }

  getNycVote(userId: number, scaled: boolean) {
    return this.callReadOnlyFn("get-nyc-vote", [types.uint(userId), types.bool(scaled)]);
  }

  // read-only function helper
  private callReadOnlyFn(method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(this.name, method, args, sender?.address);
    return result;
  }
}
