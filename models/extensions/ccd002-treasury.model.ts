import { Account, Tx, types } from "../../utils/deps.ts";

enum ErrCode {
  ERR_UNAUTHORIZED = 3100,
  ERR_ASSET_NOT_ALLOWED,
  ERR_FAILED_TO_TRANSFER_STX,
  ERR_FAILED_TO_TRANSFER_FT,
  ERR_FAILED_TO_TRANSFER_NFT,
}

interface AllowedList {
  token: string;
  enabled: boolean;
}

// General treasury model

class CCD002Treasury {
  // Basic Info

  // name redefined by extending class
  // exports defined per contract
  // below this class definition
  name = "ccd002-treasury";
  static readonly ErrCode = ErrCode;

  // Authorization

  isDaoOrExtension(sender: Account) {
    return Tx.contractCall(
      this.name,
      "is-dao-or-extension",
      [],
      sender.address
    );
  }

  // Internal DAO functions

  setAllowed(sender: Account, asset: AllowedList) {
    return Tx.contractCall(
      this.name,
      "set-allowed",
      [types.principal(asset.token), types.bool(asset.enabled)],
      sender.address
    );
  }

  setAllowedList(sender: Account, assets: AllowedList[]) {
    const assetList: any[] = [];
    for (const asset of assets) {
      assetList.push(
        types.tuple({
          token: types.principal(asset.token),
          enabled: types.bool(asset.enabled),
        })
      );
    }
    return Tx.contractCall(
      this.name,
      "set-allowed-list",
      [types.list(assetList)],
      sender.address
    );
  }

  // Deposit functions

  depositStx(sender: Account, amount: number) {
    return Tx.contractCall(
      this.name,
      "deposit-stx",
      [types.uint(amount)],
      sender.address
    );
  }

  depositFt(sender: Account, assetContract: string, amount: number) {
    return Tx.contractCall(
      this.name,
      "deposit-ft",
      [types.principal(assetContract), types.uint(amount)],
      sender.address
    );
  }

  depositNft(sender: Account, assetContract: string, id: number) {
    return Tx.contractCall(
      this.name,
      "deposit-nft",
      [types.principal(assetContract), types.uint(id)],
      sender.address
    );
  }

  // Withdraw functions

  withdrawStx(sender: Account, amount: number, recipient: string) {
    return Tx.contractCall(
      this.name,
      "withdraw-stx",
      [types.uint(amount), types.principal(recipient)],
      sender.address
    );
  }

  withdrawFt(
    sender: Account,
    assetContract: string,
    amount: number,
    recipient: string
  ) {
    return Tx.contractCall(
      this.name,
      "withdraw-ft",
      [
        types.principal(assetContract),
        types.uint(amount),
        types.principal(recipient),
      ],
      sender.address
    );
  }

  withdrawNft(
    sender: Account,
    assetContract: string,
    id: number,
    recipient: string
  ) {
    return Tx.contractCall(
      this.name,
      "withdraw-nft",
      [
        types.principal(assetContract),
        types.uint(id),
        types.principal(recipient),
      ],
      sender.address
    );
  }

  // Read only functions

  isAllowed(sender: Account, assetContract: string) {
    return Tx.contractCall(
      this.name,
      "is-allowed",
      [types.principal(assetContract)],
      sender.address
    );
  }

  getAllowedAsset(sender: Account, assetContract: string) {
    return Tx.contractCall(
      this.name,
      "get-allowed-asset",
      [types.principal(assetContract)],
      sender.address
    );
  }

  getBalanceStx(sender: Account) {
    return Tx.contractCall(this.name, "get-balance-stx", [], sender.address);
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
}

// City specific model overrides

export class CCD002TreasuryMia extends CCD002Treasury {
  // Basic Info
  name = "ccd002-treasury-mia";
}

export class CCD002TreasuryNyc extends CCD002Treasury {
  // Basic Info
  name = "ccd002-treasury-nyc";
}
