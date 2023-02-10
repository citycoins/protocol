import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 11000,
  ERR_CITY_ID_NOT_FOUND,
  ERR_STACKING_PAYOUT_INVALID,
}

export class CCD011StackingPayouts {
  name: string;
  static readonly ErrCode = ErrCode;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account, name: string) {
    this.name = name;
    this.chain = chain;
    this.deployer = deployer;
  }

  // Authorization

  isDaoOrExtension(): ReadOnlyFn {
    return this.callReadOnlyFn("is-dao-or-extension");
  }

  // Internal DAO functions

  setPoolOperator(sender: Account, operator: string) {
    return Tx.contractCall(this.name, "set-pool-operator", [types.principal(operator)], sender.address);
  }

  // send-stacking-reward-mia
  sendStackingRewardMia(sender: Account, targetCycle: number, amount: number) {
    return Tx.contractCall(this.name, "send-stacking-reward-mia", [types.uint(targetCycle), types.uint(amount)], sender.address);
  }

  // send-stacking-reward-nyc
  sendStackingRewardNyc(sender: Account, targetCycle: number, amount: number) {
    return Tx.contractCall(this.name, "send-stacking-reward-nyc", [types.uint(targetCycle), types.uint(amount)], sender.address);
  }

  // Read only functions

  getPoolOperator(): ReadOnlyFn {
    return this.callReadOnlyFn("get-pool-operator", []);
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
