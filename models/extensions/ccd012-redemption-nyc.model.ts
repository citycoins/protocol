import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 12000,
  ERR_PANIC,
  ERR_GETTING_TOTAL_SUPPLY,
  ERR_GETTING_REDEMPTION_BALANCE,
  ERR_ALREADY_ENABLED,
  ERR_NOT_ENABLED,
  ERR_BALANCE_NOT_FOUND,
  ERR_NOTHING_TO_REDEEM,
  ERR_ALREADY_CLAIMED,
}

export class CCD012RedemptionNyc {
  name: string;
  static readonly ErrCode = ErrCode;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.name = "ccd012-redemption-nyc";
    this.chain = chain;
    this.deployer = deployer;
  }

  // Authorization

  isDaoOrExtension(): ReadOnlyFn {
    return this.callReadOnlyFn("is-dao-or-extension");
  }

  // Internal DAO functions

  initializeRedemption(sender: Account) {
    return Tx.contractCall(this.name, "initialize-redemption", [], sender.address);
  }

  redeemNyc(sender: Account) {
    return Tx.contractCall(this.name, "redeem-nyc", [], sender.address);
  }

  // Read only functions

  isRedemptionEnabled(): ReadOnlyFn {
    return this.callReadOnlyFn("is-redemption-enabled", []);
  }

  getRedemptionBlockHeight(): ReadOnlyFn {
    return this.callReadOnlyFn("get-redemption-block-height", []);
  }

  getRedemptionTotalSupply(): ReadOnlyFn {
    return this.callReadOnlyFn("get-redemption-total-supply", []);
  }

  getRedemptionContractBalance(): ReadOnlyFn {
    return this.callReadOnlyFn("get-redemption-contract-balance", []);
  }

  getRedemptionRatio(): ReadOnlyFn {
    return this.callReadOnlyFn("get-redemption-ratio", []);
  }

  getRedemptionInfo(): ReadOnlyFn {
    return this.callReadOnlyFn("get-redemption-info", []);
  }

  getNycBalances(address: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-nyc-balances", [types.principal(address)]);
  }

  getRedemptionForBalance(balance: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-redemption-for-balance", [types.uint(balance)]);
  }

  getRedemptionAmountClaimed(address: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-redemption-amount-claimed", [types.principal(address)]);
  }

  getUserRedemptionInfo(address: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-user-redemption-info", [types.principal(address)]);
  }

  // Extension callback

  callback(sender: Account, memo: string) {
    return Tx.contractCall(this.name, "callback", [types.principal(sender.address), types.buff(memo)], sender.address);
  }

  // Utility functions

  private callReadOnlyFn(method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(this.name, method, args, sender?.address);
    return result;
  }
}
