import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 6000,
  ERR_INVALID_CITY,
  ERR_NO_ACTIVATION_DETAILS,
  ERR_INACTIVE_CITY,
  ERR_INVALID_USER,
  ERR_INVALID_TREASURY,
  ERR_INVALID_DELAY,
  ERR_INVALID_COMMITS,
  ERR_NOT_ENOUGH_FUNDS,
  ERR_ALREADY_MINED,
  ERR_REWARD_IMMATURE,
  ERR_NO_VRF_SEED,
  ERR_DID_NOT_MINE,
  ERR_NO_MINER_DATA,
  ERR_ALREADY_CLAIMED,
  ERR_MINER_NOT_WINNER,
  ERR_MINING_DISABLED,
}

export class CCD006CityMining {
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

  mine(sender: Account, cityName: string, amounts: Array<number>) {
    return Tx.contractCall(this.name, "mine", [types.ascii(cityName), types.list(amounts.map((entry) => types.uint(entry)))], sender.address);
  }

  claimMiningReward(sender: Account, cityName: string, claimHeight: number) {
    return Tx.contractCall(this.name, "claim-mining-reward", [types.ascii(cityName), types.uint(claimHeight)], sender.address);
  }

  setRewardDelay(sender: Account, delay: number) {
    return Tx.contractCall(this.name, "set-reward-delay", [types.uint(delay)], sender.address);
  }

  setMiningStatus(sender: Account, status: boolean) {
    return Tx.contractCall(this.name, "set-mining-status", [types.bool(status)], sender.address);
  }

  // Read only functions

  isBlockWinner(cityId: number, user: string, claimHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("is-block-winner", [types.uint(cityId), types.principal(user), types.uint(claimHeight)]);
  }

  getBlockWinner(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-block-winner", [types.uint(cityId), types.uint(blockHeight)]);
  }

  getHighValue(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-high-value", [types.uint(cityId), types.uint(blockHeight)]);
  }

  getMinerAtBlock(cityId: number, blockHeight: number, userId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-miner", [types.uint(cityId), types.uint(blockHeight), types.uint(userId)]);
  }

  hasMinedAtBlock(cityId: number, blockHeight: number, userId: number): ReadOnlyFn {
    return this.callReadOnlyFn("has-mined-at-block", [types.uint(cityId), types.uint(blockHeight), types.uint(userId)]);
  }

  getMiningStatsAtBlock(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-mining-stats", [types.uint(cityId), types.uint(blockHeight)]);
  }

  getCoinbaseAmount(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-coinbase-amount", [types.uint(cityId), types.uint(blockHeight)]);
  }

  getRewardDelay(): ReadOnlyFn {
    return this.callReadOnlyFn("get-reward-delay", []);
  }

  isMiningEnabled(): ReadOnlyFn {
    return this.callReadOnlyFn("is-mining-enabled", []);
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
