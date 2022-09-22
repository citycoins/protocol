import { Account, Tx, types } from "../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 1000,
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

  // Extensions

  isExtension(sender: Account, extension: string) {
    return Tx.contractCall(
      this.name,
      "is-extension",
      [types.principal(extension)],
      sender.address
    );
  }

  setExtension(sender: Account, ext: Extension) {
    return Tx.contractCall(
      this.name,
      "set-extension",
      [types.principal(ext.extension), types.bool(ext.enabled)],
      sender.address
    );
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
    return Tx.contractCall(
      this.name,
      "set-extensions",
      [types.list(extensionList)],
      sender.address
    );
  }

  // Proposals

  executedAt(sender: Account, proposal: string) {
    return Tx.contractCall(
      this.name,
      "executed-at",
      [types.principal(proposal)],
      sender.address
    );
  }

  execute(sender: Account, proposal: string, proposer: string) {
    return Tx.contractCall(
      this.name,
      "execute",
      [types.principal(proposal), types.principal(proposer)],
      sender.address
    );
  }

  // Bootstrap

  construct(sender: Account, proposal: string) {
    return Tx.contractCall(
      this.name,
      "construct",
      [types.principal(proposal)],
      sender.address
    );
  }

  // Extension requests

  requestExtensionCallback(sender: Account, extension: string, memo: string) {
    return Tx.contractCall(
      this.name,
      "request-extension-callback",
      [types.principal(extension), types.buff(memo)],
      sender.address
    );
  }
}
