import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  err_owner_only = 100,
  err_token_id_failure = 101,
  err_not_token_owner = 102,
}

export class CCEXTNft {
  name: string;
  static readonly ErrCode = ErrCode;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account, name: string) {
    this.name = name;
    this.chain = chain;
    this.deployer = deployer;
  }

  transfer(
    tokenId: number,
    sender: string,
    recipient: string,
    txSender: string
  ): Tx {
    return Tx.contractCall(
      this.name,
      "transfer",
      [
        types.uint(tokenId),
        types.principal(sender),
        types.principal(recipient),
      ],
      txSender
    );
  }
  mint(recipient: string, txSender: string): Tx {
    return Tx.contractCall(
      this.name,
      "mint",
      [types.principal(recipient)],
      txSender
    );
  }
  getOwner(tokenId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-owner", [types.uint(tokenId)]);
  }

  private callReadOnlyFn(
    method: string,
    // deno-lint-ignore no-explicit-any
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
