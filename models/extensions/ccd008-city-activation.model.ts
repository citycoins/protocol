import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 8000,
  ERR_NO_ACITVATION_DETAILS,
  ERR_ACTIVE_CITY,
  ERR_ALREADY_VOTED,
}

export class CCD008CityActivation {
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

  activateCity(sender: Account, cityId: number, memo: string) {
    return Tx.contractCall(this.name, "activate-city", [types.uint(cityId), memo ? types.some(types.ascii(memo)) : types.none()], sender.address);
  }

  // Read only functions

  getCityActivationSignals(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-activation-signals", [types.uint(cityId)]);
  }

  getCityActivationVoter(cityId: number, signaler: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-activation-voter", [types.uint(cityId), types.principal(signaler)]);
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
