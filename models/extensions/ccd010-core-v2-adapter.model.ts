import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 10000,
  ERR_DISABLED,
  ERR_NOTHING_TO_MINT,
}

export class CCD010CoreV2Adapter {
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

  isExtension(): ReadOnlyFn {
    return this.callReadOnlyFn("is-extension");
  }

  // Internal DAO functions

  // disabled functions (legacy protocol)

  registerUser(sender: Account, memo: string) {
    return Tx.contractCall(this.name, "register-user", [types.some(types.utf8(memo))], sender.address);
  }

  mineTokens(sender: Account, amount: number, memo: string) {
    return Tx.contractCall(this.name, "mine-tokens", [types.uint(amount), types.some(types.buff(memo))], sender.address);
  }

  mineMany(sender: Account, amounts: Array<number>) {
    return Tx.contractCall(this.name, "mine-many", [types.list(amounts.map((entry) => types.uint(entry)))], sender.address);
  }

  claimMiningReward(sender: Account, blockHeight: number) {
    return Tx.contractCall(this.name, "claim-mining-reward", [types.uint(blockHeight)], sender.address);
  }

  stackTokens(sender: Account, amountTokens: number, lockPeriod: number) {
    return Tx.contractCall(this.name, "stack-tokens", [types.uint(amountTokens), types.uint(lockPeriod)], sender.address);
  }

  claimStackingReward(sender: Account, targetCycle: number) {
    return Tx.contractCall(this.name, "claim-stacking-reward", [types.uint(targetCycle)], sender.address);
  }

  shutdownContract(sender: Account, height: number) {
    return Tx.contractCall(this.name, "shutdown-contract", [types.uint(height)], sender.address);
  }

  setCityWallet(sender: Account, newCityWallet: string) {
    return Tx.contractCall(this.name, "set-city-wallet", [types.principal(newCityWallet)], sender.address);
  }

  updateCoinbaseThresholds(sender: Account) {
    return Tx.contractCall(this.name, "update-coinbase-thresholds", [], sender.address);
  }

  updateCoinbaseAmounts(sender: Account) {
    return Tx.contractCall(this.name, "update-coinbase-amounts", [], sender.address);
  }

  mintCoinbase(sender: Account, cityName: string, recipient: string, amount: number) {
    return Tx.contractCall(this.name, "mint-coinbase", [types.utf8(cityName), types.principal(recipient), types.uint(amount)], sender.address);
  }

  // Extension callback

  callback(sender: Account, memo: string) {
    return Tx.contractCall(this.name, "callback", [types.principal(sender.address), types.buff(memo)], sender.address);
  }

  private callReadOnlyFn(method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(this.name, method, args, sender?.address);
    return result;
  }
}
