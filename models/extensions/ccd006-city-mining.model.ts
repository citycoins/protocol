import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 6000,
  ERR_INVALID_DELAY,
  ERR_INVALID_COMMIT_AMOUNTS,
  ERR_INSUFFICIENT_BALANCE,
  ERR_ALREADY_MINED,
  ERR_INSUFFICIENT_COMMIT,
  ERR_REWARD_NOT_MATURE,
  ERR_VRF_SEED_NOT_FOUND,
  ERR_DID_NOT_MINE,
  ERR_MINER_DATA_NOT_FOUND,
  ERR_ALREADY_CLAIMED,
  ERR_MINER_NOT_WINNER,
  ERR_NOTHING_TO_MINT,
  ERR_USER_ID_NOT_FOUND,
  ERR_CITY_ID_NOT_FOUND,
  ERR_CITY_NAME_NOT_FOUND,
  ERR_CITY_NOT_ACTIVATED,
  ERR_CITY_DETAILS_NOT_FOUND,
  ERR_CITY_TREASURY_NOT_FOUND,
  ERR_FUNCTION_DISABLED,
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

  setRewardDelay(sender: Account, delay: number) {
    return Tx.contractCall(this.name, "set-reward-delay", [types.uint(delay)], sender.address);
  }

  claimMiningBlock(sender: Account, cityName: string, claimHeight: number) {
    return Tx.contractCall(this.name, "claim-mining-block", [types.ascii(cityName), types.uint(claimHeight)], sender.address);
  }

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

  setCityWallet(sender: Account, newCityWallet: string) {
    return Tx.contractCall(this.name, "set-city-wallet", [types.principal(newCityWallet)], sender.address);
  }

  updateCoinbaseThresholds(sender: Account) {
    return Tx.contractCall(this.name, "update-coinbase-thresholds", [], sender.address);
  }

  updateCoinbaseAmounts(sender: Account) {
    return Tx.contractCall(this.name, "update-coinbase-amounts", [], sender.address);
  }

  shutdownContract(sender: Account, height: number) {
    return Tx.contractCall(this.name, "shutdown-contract", [types.uint(height)], sender.address);
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
    return this.callReadOnlyFn("get-miner-at-block", [types.uint(cityId), types.uint(blockHeight), types.uint(userId)]);
  }

  hasMinedAtBlock(cityId: number, blockHeight: number, userId: number): ReadOnlyFn {
    return this.callReadOnlyFn("has-mined-at-block", [types.uint(cityId), types.uint(blockHeight), types.uint(userId)]);
  }

  getMiningStatsAtBlock(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-mining-stats-at-block", [types.uint(cityId), types.uint(blockHeight)]);
  }

  getCoinbaseAmount(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-coinbase-amount", [types.uint(cityId), types.uint(blockHeight)]);
  }

  getRewardDelay(): ReadOnlyFn {
    return this.callReadOnlyFn("get-reward-delay", []);
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
