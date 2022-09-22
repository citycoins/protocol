import { Account, Tx, types } from "../../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 3000,
  ERR_NOT_APPROVER,
  ERR_ALREADY_EXECUTED,
  ERR_SUNSET_REACHED,
  ERR_SUNSET_IN_PAST,
}

export class CCD001DirectExecute {
  // Basic Info

  name = "ccd001-direct-execute";
  static readonly ErrCode = ErrCode;

  // Authorization

  isDaoOrExtension(sender: Account) {
    return Tx.contractCall(
      this.name,
      "is-dao-or-extension",
      [],
      sender.address
    );
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

  isApprover(sender: Account) {
    return Tx.contractCall(this.name, "is-approver", [], sender.address);
  }

  hasSignalled(sender: Account, proposal: string, who: string) {
    return Tx.contractCall(
      this.name,
      "has-signalled",
      [types.principal(proposal), types.principal(who)],
      sender.address
    );
  }

  getSignalsRequired(sender: Account) {
    return Tx.contractCall(
      this.name,
      "get-signals-required",
      [],
      sender.address
    );
  }

  getSignals(sender: Account, proposal: string) {
    return Tx.contractCall(
      this.name,
      "get-signals",
      [types.principal(proposal)],
      sender.address
    );
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

  extensionCallback(sender: Account, memo: string) {
    return Tx.contractCall(
      this.name,
      "callback",
      [types.buff(memo)],
      sender.address
    );
  }
}
