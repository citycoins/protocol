import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 4000,
}

export class CCD004CityRegistry {
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

  getOrCreateCityId(sender: Account, cityName: string) {
    return Tx.contractCall(this.name, "get-or-create-city-id", [types.ascii(cityName)], sender.address);
  }

  // Read only functions

  getCityId(cityName: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-id", [types.ascii(cityName)]);
  }

  getCityName(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-name", [types.uint(cityId)]);
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
