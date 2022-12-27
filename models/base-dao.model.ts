import { Chain, Account, Tx, types, ReadOnlyFn } from "../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 900,
  ERR_ALREADY_EXECUTED,
  ERR_INVALID_EXTENSION,
}

interface Extension {
  extension: string;
  enabled: boolean;
}

export class BaseDao {
  // Basic Info

  name = "base-dao";
  static readonly ErrCode = ErrCode;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  // Extensions

  isExtension(extension: string): ReadOnlyFn {
    return this.callReadOnlyFn("is-extension", [types.principal(extension)]);
  }

  setExtension(sender: Account, ext: Extension) {
    return Tx.contractCall(this.name, "set-extension", [types.principal(ext.extension), types.bool(ext.enabled)], sender.address);
  }

  setExtensions(sender: Account, exts: Extension[]) {
    const extensionList: any[] = [];
    for (const ext of exts) {
      extensionList.push(
        types.tuple({
          extension: types.principal(ext.extension),
          enabled: types.bool(ext.enabled),
        })
      );
    }
    return Tx.contractCall(this.name, "set-extensions", [types.list(extensionList)], sender.address);
  }

  // Proposals

  executedAt(sender: Account, proposal: string) {
    return Tx.contractCall(this.name, "executed-at", [types.principal(proposal)], sender.address);
  }

  execute(sender: Account, proposal: string, proposer: string) {
    return Tx.contractCall(this.name, "execute", [types.principal(proposal), types.principal(proposer)], sender.address);
  }

  // Bootstrap

  construct(sender: Account, proposal: string) {
    return Tx.contractCall(this.name, "construct", [types.principal(proposal)], sender.address);
  }

  // Extension requests

  requestExtensionCallback(sender: Account, extension: string, memo: string) {
    return Tx.contractCall(this.name, "request-extension-callback", [types.principal(extension), types.buff(memo)], sender.address);
  }

  private callReadOnlyFn(method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(this.name, method, args, sender?.address);
    return result;
  }
}
