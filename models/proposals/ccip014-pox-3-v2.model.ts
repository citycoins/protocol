import { Chain, Account, ReadOnlyFn } from "../../utils/deps.ts";

enum ErrCode {
  ERR_PANIC = 1400,
  ERR_VOTED_ALREADY,
  ERR_NOTHING_STACKED,
  ERR_USER_NOT_FOUND,
  ERR_PROPOSAL_NOT_ACTIVE,
  ERR_PROPOSAL_STILL_ACTIVE,
  ERR_NO_CITY_ID,
  ERR_VOTE_FAILED,
}

export class CCIP014Pox3v2 {
  name = "ccip014-pox-3-v2";
  static readonly ErrCode = ErrCode;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  // public functions

  // execute() excluded since called by passProposal and CCD001

  // read-only functions

  isExecutable() {
    return this.callReadOnlyFn("is-executable");
  }

  // read-only function helper
  private callReadOnlyFn(method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(this.name, method, args, sender?.address);
    return result;
  }
}
