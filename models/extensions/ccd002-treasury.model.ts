import { Account, Tx, types } from "../../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 3100,
  ERR_ASSET_NOT_WHITELISTED,
  ERR_FAILED_TO_TRANSFER_STX,
  ERR_FAILED_TO_TRANSFER_FT,
  ERR_FAILED_TO_TRANSFER_NFT,
}

// General treasury model

class CCD002Treasury {
  // Basic Info

  // name redefined by extending class
  // exports defined per contract
  name = "ccd002-treasury";
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

// City specific model overrides

export class CCD002TreasuryMia extends CCD002Treasury {
  // Basic Info
  name = "ccd002-treasury-mia";
}

export class CCD002TreasuryNyc extends CCD002Treasury {
  // Basic Info
  name = "ccd002-treasury-nyc";
}
