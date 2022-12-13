import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 3000,
}

export class CCD003UserRegistry {
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

  getOrCreateUserId(sender: Account, user: string) {
    return Tx.contractCall(
      this.name,
      "get-or-create-user-id",
      [types.principal(user)],
      sender.address
    );
  }

  // Read only functions

  getUserId(user: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-user-id", [types.principal(user)]);
  }

  getUser(userId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-user", [types.uint(userId)]);
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
