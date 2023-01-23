import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 7000,
  ERR_INVALID_CYCLE_LENGTH,
  ERR_INVALID_STACKING_PARAMS,
  // ERR_STACKING_NOT_AVAILABLE,
  ERR_REWARD_CYCLE_NOT_COMPLETE,
  ERR_NOTHING_TO_CLAIM,
  ERR_INVALID_STACKING_PAYOUT,
  ERR_USER_ID_NOT_FOUND,
  ERR_CITY_ID_NOT_FOUND,
  ERR_CITY_NOT_ACTIVATED,
  ERR_CITY_TREASURY_NOT_FOUND,
}

export class CCD007CityStacking {
  name: string;
  static readonly ErrCode = ErrCode;
  static readonly MAX_REWARD_CYCLES = 32;
  static readonly REWARD_CYCLE_LENGTH = 2100;
  static readonly FIRST_STACKING_BLOCK = 50; // MAINNET: 666050, TESTNET: 2000000
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

  claimStackingReward(sender: Account, cityName: string, targetCycle: number) {
    return Tx.contractCall(this.name, "claim-stacking-reward", [types.ascii(cityName), types.uint(targetCycle)], sender.address);
  }
  sendStackingReward(sender: Account, cityName: string, targetCycle: number, amount: number) {
    return Tx.contractCall(this.name, "send-stacking-reward", [types.ascii(cityName), types.uint(targetCycle), types.uint(amount)], sender.address);
  }
  setPoolOperator(sender: Account, operator: string) {
    return Tx.contractCall(this.name, "set-pool-operator", [types.principal(operator)], sender.address);
  }
  stack(sender: Account, cityName: string, amount: number, lockPeriod: number) {
    return Tx.contractCall(this.name, "stack", [types.ascii(cityName), types.uint(amount), types.uint(lockPeriod)], sender.address);
  }
  /* disabled - function removed from ccd007
  setRewardCycleLength(sender: Account, length: number) {
    return Tx.contractCall(this.name, "set-reward-cycle-length", [types.uint(length)], sender.address);
  }
  */

  // Read only functions

  getRewardCycleLength(): ReadOnlyFn {
    return this.callReadOnlyFn("get-reward-cycle-length", []);
  }
  getStackingStatsAtCycle(cityId: number, cycle: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-stacking-stats-at-cycle", [types.uint(cityId), types.uint(cycle)]);
  }
  getStackerAtCycle(cityId: number, cycle: number, userId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-stacker-at-cycle", [types.uint(cityId), types.uint(cycle), types.uint(userId)]);
  }
  getCurrentRewardCycle(): ReadOnlyFn {
    return this.callReadOnlyFn("get-current-reward-cycle", []);
  }
  getRewardCycle(blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-reward-cycle", [types.uint(blockHeight)]);
  }
  getFirstBlockInRewardCycle(cycle: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-first-block-in-reward-cycle", [types.uint(cycle)]);
  }
  isStackingActive(cityId: number, cycle: number): ReadOnlyFn {
    return this.callReadOnlyFn("is-stacking-active", [types.uint(cityId), types.uint(cycle)]);
  }
  isCyclePaid(cityId: number, cycle: number): ReadOnlyFn {
    return this.callReadOnlyFn("is-cycle-paid", [types.uint(cityId), types.uint(cycle)]);
  }
  getStackingReward(cityId: number, userId: number, cycle: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-stacking-reward", [types.uint(cityId), types.uint(userId), types.uint(cycle)]);
  }
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
