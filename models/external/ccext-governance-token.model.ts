import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 3000,
  ERR_NOT_TOKEN_OWNER = 4,
}

export class CCEXTGovernanceToken {
  // Basic Info

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

  transfer(amount: number, sender: string, recipient: string, memo: string, txSender: string): Tx {
    return Tx.contractCall(
      this.name,
      "transfer",
      [types.uint(amount), types.principal(sender), types.principal(recipient), (memo && memo.length > 0) ? types.some(types.buff(memo)) : types.none()], txSender);
  }

  getName(): ReadOnlyFn {
    return this.callReadOnlyFn("get-name", []);
  }
  getSymbol(): ReadOnlyFn {
    return this.callReadOnlyFn("get-symbol", []);
  }
  getTokenUri(): ReadOnlyFn {
    return this.callReadOnlyFn("get-token-uri", []);
  }
  getDecimals(): ReadOnlyFn {
    return this.callReadOnlyFn("get-decimals", []);
  }
  getTotalSupply(): ReadOnlyFn {
    return this.callReadOnlyFn("get-total-supply", []);
  }
  getBalance(who: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-balance", [types.principal(who)]);
  }

  setName(value: string, txSender: string): Tx {
    return Tx.contractCall(
      this.name,
      "set-name",
      [types.ascii(value)], txSender);
  }
  setSymbol(value: string, txSender: string): Tx {
    return Tx.contractCall(
      this.name,
      "set-symbol",
      [types.ascii(value)], txSender);
  }
  setTokenUri(value: string, txSender: string): Tx {
    return Tx.contractCall(
      this.name,
      "set-token-uri",
      [types.some(types.utf8(value))], txSender);
  }
  setDecimals(value: number, txSender: string): Tx {
    return Tx.contractCall(
      this.name,
      "set-decimals",
      [types.uint(value)], txSender);
  }

  edgMint(amount: number, recipient: string, txSender: string): Tx {
    return Tx.contractCall(
      this.name,
      "edg-mint",
      [types.uint(amount), types.principal(recipient)], txSender);
  }

  edgBurn(amount: number, owner: string, txSender: string): Tx {
    return Tx.contractCall(
      this.name,
      "edg-burn",
      [types.uint(amount), types.principal(owner)], txSender);
  }

  private callReadOnlyFn(
    method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(
      this.name,
      method,
      args,
      sender?.address
    );
    return result;
  }

}
