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

  setExtension(extension: Extension) {
    return false;
  }

  setExtensions(extensionList: Extension[]) {
    return false;
  }

  // Proposals

  executedAt(proposal: string) {
    return false;
  }

  execute(proposal: string, sender: string) {
    return false;
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

  requestExtensionCallback(extension: string, memo: string) {
    return false;
  }
}
