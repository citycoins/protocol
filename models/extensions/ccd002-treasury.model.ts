import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

enum ErrCode {
  ERR_INSUFFICIENT_BALANCE = 1,
  ERR_UNAUTHORIZED = 2000,
  ERR_ASSET_NOT_ALLOWED,
  ERR_FAILED_TO_TRANSFER_STX,
  ERR_FAILED_TO_TRANSFER_FT,
  ERR_FAILED_TO_TRANSFER_NFT,
}

interface AllowedList {
  token: string;
  enabled: boolean;
}

export interface PoxAddress {
  version: string;
  hashbytes: string;
}

// General treasury model

export class CCD002Treasury {
  // Basic Info

  // name redefined by extending class
  // exports defined per contract
  // below this class definition
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

  setAllowed(sender: Account, asset: AllowedList) {
    return Tx.contractCall(this.name, "set-allowed", [types.principal(asset.token), types.bool(asset.enabled)], sender.address);
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
    return Tx.contractCall(this.name, "set-allowed-list", [types.list(assetList)], sender.address);
  }

  // Deposit functions

  depositStx(sender: Account, amount: number) {
    return Tx.contractCall(this.name, "deposit-stx", [types.uint(amount)], sender.address);
  }

  depositFt(sender: Account, assetContract: string, amount: number) {
    return Tx.contractCall(this.name, "deposit-ft", [types.principal(assetContract), types.uint(amount)], sender.address);
  }

  depositNft(sender: Account, assetContract: string, id: number) {
    return Tx.contractCall(this.name, "deposit-nft", [types.principal(assetContract), types.uint(id)], sender.address);
  }

  // Withdraw functions

  withdrawStx(sender: Account, amount: number, recipient: string) {
    return Tx.contractCall(this.name, "withdraw-stx", [types.uint(amount), types.principal(recipient)], sender.address);
  }

  withdrawFt(sender: Account, assetContract: string, amount: number, recipient: string) {
    return Tx.contractCall(this.name, "withdraw-ft", [types.principal(assetContract), types.uint(amount), types.principal(recipient)], sender.address);
  }

  withdrawNft(sender: Account, assetContract: string, id: number, recipient: string) {
    return Tx.contractCall(this.name, "withdraw-nft", [types.principal(assetContract), types.uint(id), types.principal(recipient)], sender.address);
  }

  // Stacking functions

  delegateStx(sender: Account, amount: number, delegateTo: string) {
    return Tx.contractCall(this.name, "delegate-stx", [types.uint(amount), types.principal(delegateTo)], sender.address);
  }

  revokeDelegateStx(sender: Account) {
    return Tx.contractCall(this.name, "revoke-delegate-stx", [], sender.address);
  }

  // Read only functions

  isAllowed(assetContract: string): ReadOnlyFn {
    return this.callReadOnlyFn("is-allowed", [types.principal(assetContract)]);
  }

  getAllowedAsset(assetContract: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-allowed-asset", [types.principal(assetContract)]);
  }

  getBalanceStx(): ReadOnlyFn {
    return this.callReadOnlyFn("get-balance-stx");
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
