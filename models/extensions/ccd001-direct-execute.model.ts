import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 3000,
  ERR_NOT_APPROVER,
  ERR_SUNSET_REACHED,
  ERR_SUNSET_IN_PAST,
}

export class CCD001DirectExecute {
  // Basic Info

  name = "ccd001-direct-execute";
  static readonly ErrCode = ErrCode;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  // Authorization

  isDaoOrExtension(): ReadOnlyFn {
    return this.callReadOnlyFn("is-dao-or-extension");
  }

  // Internal DAO functions

  setSunsetBlockHeight(sender: Account, sunsetBlockHeight: number) {
    return Tx.contractCall(
      this.name,
      "set-sunset-block-height",
      [types.uint(sunsetBlockHeight)],
      sender.address
    );
  }

  setApprover(sender: Account, approver: string, status: boolean) {
    return Tx.contractCall(
      this.name,
      "set-approver",
      [types.principal(approver), types.bool(status)],
      sender.address
    );
  }

  setSignalsRequired(sender: Account, newRequirement: number) {
    return Tx.contractCall(
      this.name,
      "set-signals-required",
      [types.uint(newRequirement)],
      sender.address
    );
  }

  // Public Functions

  isApprover(who: string): ReadOnlyFn {
    return this.callReadOnlyFn("is-approver", [types.principal(who)]);
  }
  hasSignalled(proposal: string, who: string): ReadOnlyFn {
    return this.callReadOnlyFn("has-signalled", [types.principal(proposal), types.principal(who)]);
  }
  getSignalsRequired(): ReadOnlyFn {
    return this.callReadOnlyFn("get-signals-required");
  }
  getSignals(proposal: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-signals", [types.principal(proposal)]);
  }

  directExecute(sender: Account, proposal: string) {
    return Tx.contractCall(
      this.name,
      "direct-execute",
      [types.principal(proposal)],
      sender.address
    );
  }

  // Extension callback

  callback(sender: Account, memo: string) {
    return Tx.contractCall(
      this.name,
      "callback",
      [types.principal(sender.address), types.buff(memo)],
      sender.address
    );
  }

  private callReadOnlyFn(
    method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(
      this.name,
      method,
      args,
      sender?.address
    );
    return result;
  }

}
