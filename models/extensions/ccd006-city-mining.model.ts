import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 6000,
  ERR_INVALID_DELAY = 6001,
  ERR_INVALID_COMMIT_AMOUNTS = 6002,
  ERR_INSUFFICIENT_BALANCE = 6003,
  ERR_ALREADY_MINED = 6004,
  ERR_INSUFFICIENT_COMMIT = 6005,
  ERR_REWARD_NOT_MATURE = 6006,
  ERR_VRF_SEED_NOT_FOUND = 6007,
  ERR_DID_NOT_MINE = 6008,
  ERR_MINER_DATA_NOT_FOUND = 6009,
  ERR_ALREADY_CLAIMED = 6010,
  ERR_MINER_NOT_WINNER = 6011,
  ERR_NOTHING_TO_MINT = 6012,
  ERR_USER_ID_NOT_FOUND = 6013,
  ERR_CITY_ID_NOT_FOUND = 6014,
  ERR_CITY_NAME_NOT_FOUND = 6015,
  ERR_CITY_NOT_ACTIVATED = 6016,
  ERR_CITY_DETAILS_NOT_FOUND = 6017,
  ERR_CITY_TREASURY_NOT_FOUND = 6018,
  ERR_CITY_COINBASE_THRESHOLDS_NOT_FOUND = 6019,
  ERR_CITY_COINBASE_AMOUNTS_NOT_FOUND = 6020,
  ERR_CITY_COINBASE_BONUS_PERIOD_NOT_FOUND = 6021,
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
    return Tx.contractCall(
      this.name,
      "mine",
      [
        types.ascii(cityName),
        types.list(amounts.map((entry) => types.uint(entry))),
      ],
      sender.address
    );
  }

  setRewardDelay(sender: Account, delay: number) {
    return Tx.contractCall(
      this.name,
      "set-reward-delay",
      [types.uint(delay)],
      sender.address
    );
  }

  claimMiningReward(sender: Account, cityName: string, claimHeight: number) {
    return Tx.contractCall(
      this.name,
      "claim-mining-reward",
      [types.ascii(cityName), types.uint(claimHeight)],
      sender.address
    );
  }

  // Read only functions

  isBlockWinner(cityId: number, user: string, claimHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("is-block-winner", [
      types.uint(cityId),
      types.principal(user),
      types.uint(claimHeight),
    ]);
  }

  getBlockWinner(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-block-winner", [
      types.uint(cityId),
      types.uint(blockHeight),
    ]);
  }

  getHighValue(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-high-value", [
      types.uint(cityId),
      types.uint(blockHeight),
    ]);
  }

  getMinerAtBlock(
    cityId: number,
    blockHeight: number,
    userId: number
  ): ReadOnlyFn {
    return this.callReadOnlyFn("get-miner-at-block", [
      types.uint(cityId),
      types.uint(blockHeight),
      types.uint(userId),
    ]);
  }

  hasMinedAtBlock(
    cityId: number,
    blockHeight: number,
    userId: number
  ): ReadOnlyFn {
    return this.callReadOnlyFn("has-mined-at-block", [
      types.uint(cityId),
      types.uint(blockHeight),
      types.uint(userId),
    ]);
  }

  getMiningStatsAtBlock(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-mining-stats-at-block", [
      types.uint(cityId),
      types.uint(blockHeight),
    ]);
  }

  getCoinbaseAmount(cityId: number, blockHeight: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-coinbase-amount", [
      types.uint(cityId),
      types.uint(blockHeight),
    ]);
  }

  getRewardDelay(): ReadOnlyFn {
    return this.callReadOnlyFn("get-reward-delay", []);
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
    method: string,
    args: Array<any> = [],
    sender: Account = this.deployer
  ): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(
      this.name,
      method,
      args,
      sender?.address
    );
    return result;
  }
}
