import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 7000,
  ERR_INVALID_CITY,
  ERR_INVALID_PARAMS,
  ERR_INACTIVE_CITY,
  ERR_INVALID_USER,
  ERR_INVALID_TREASURY,
  ERR_INCOMPLETE_CYCLE,
  ERR_NOTHING_TO_CLAIM,
  ERR_PAYOUT_COMPLETE,
  ERR_STACKING_DISABLED,
}

export class CCD007CityStacking {
  name: string;
  static readonly ErrCode = ErrCode;
  static readonly MAX_REWARD_CYCLES = 32;
  static readonly REWARD_CYCLE_LENGTH = 2100; // TESTNET: 1050
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

  isExtension(): ReadOnlyFn {
    return this.callReadOnlyFn("is-extension");
  }

  // Internal DAO functions

  claimStackingReward(sender: Account, cityName: string, targetCycle: number) {
    return Tx.contractCall(this.name, "claim-stacking-reward", [types.ascii(cityName), types.uint(targetCycle)], sender.address);
  }
  sendStackingReward(sender: Account, cityName: string, targetCycle: number, amount: number) {
    return Tx.contractCall(this.name, "send-stacking-reward", [types.ascii(cityName), types.uint(targetCycle), types.uint(amount)], sender.address);
  }
  stack(sender: Account, cityName: string, amount: number, lockPeriod: number) {
    return Tx.contractCall(this.name, "stack", [types.ascii(cityName), types.uint(amount), types.uint(lockPeriod)], sender.address);
  }
  setStackingEnabled(sender: Account, status: boolean) {
    return Tx.contractCall(this.name, "set-stacking-enabled", [types.bool(status)], sender.address);
  }

  // Read only functions

  isStackingEnabled(): ReadOnlyFn {
    return this.callReadOnlyFn("is-stacking-enabled", []);
  }
  getRewardCycleLength(): ReadOnlyFn {
    return this.callReadOnlyFn("get-reward-cycle-length", []);
  }
  getStackingStats(cityId: number, cycle: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-stacking-stats", [types.uint(cityId), types.uint(cycle)]);
  }
  getStacker(cityId: number, cycle: number, userId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-stacker", [types.uint(cityId), types.uint(cycle), types.uint(userId)]);
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
