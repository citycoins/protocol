import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 5000,
  ERR_ACTIVATION_DETAILS_NOT_FOUND,
  ERR_CONTRACT_ALREADY_ACTIVE,
  ERR_CONTRACT_INACTIVE,
  ERR_TREASURY_ALREADY_EXISTS,
  ERR_ALREADY_VOTED,
  ERR_INVALID_THRESHOLDS,
  ERR_INVALID_AMOUNTS,
  ERR_INVALID_BONUS_PERIOD,
  ERR_INVALID_CITY,
}

export class CCD005CityData {
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

  setCityActivationStatus(sender: Account, cityId: number, status: boolean) {
    return Tx.contractCall(
      this.name,
      "set-city-activation-status",
      [types.uint(cityId), types.bool(status)],
      sender.address
    );
  }

  setCityActivationDetails(
    sender: Account,
    cityId: number,
    activated: number,
    delay: number,
    target: number,
    threshold: number
  ) {
    return Tx.contractCall(
      this.name,
      "set-city-activation-details",
      [
        types.uint(cityId),
        types.uint(activated),
        types.uint(delay),
        types.uint(target),
        types.uint(threshold),
      ],
      sender.address
    );
  }

  activateCity(sender: Account, cityId: number, memo: string) {
    return Tx.contractCall(
      this.name,
      "activate-city",
      [types.uint(cityId), memo ? types.some(types.ascii(memo)) : types.none()],
      sender.address
    );
  }

  addCityTreasury(
    sender: Account,
    cityId: number,
    address: string,
    name: string
  ) {
    return Tx.contractCall(
      this.name,
      "add-city-treasury",
      [types.uint(cityId), types.principal(address), types.ascii(name)],
      sender.address
    );
  }

  addCityTokenContract(sender: Account, cityId: number, address: string) {
    return Tx.contractCall(
      this.name,
      "add-city-token-contract",
      [types.uint(cityId), types.principal(address)],
      sender.address
    );
  }

  setActiveCityTokenContract(sender: Account, cityId: number, tokenId: number) {
    return Tx.contractCall(
      this.name,
      "set-active-city-token-contract",
      [types.uint(cityId), types.uint(tokenId)],
      sender.address
    );
  }

  setCityCoinbaseBonusPeriod(
    sender: Account,
    cityId: number,
    bonusPeriod: number
  ) {
    return Tx.contractCall(
      this.name,
      "set-city-coinbase-bonus-period",
      [types.uint(cityId), types.uint(bonusPeriod)],
      sender.address
    );
  }

  setCityCoinbaseThresholds(
    sender: Account,
    cityId: number,
    threshold1: number,
    threshold2: number,
    threshold3: number,
    threshold4: number,
    threshold5: number
  ) {
    return Tx.contractCall(
      this.name,
      "set-city-coinbase-thresholds",
      [
        types.uint(cityId),
        types.uint(threshold1),
        types.uint(threshold2),
        types.uint(threshold3),
        types.uint(threshold4),
        types.uint(threshold5),
      ],
      sender.address
    );
  }

  setCityCoinbaseAmounts(
    sender: Account,
    cityId: number,
    amountBonus: number,
    amount1: number,
    amount2: number,
    amount3: number,
    amount4: number,
    amount5: number,
    amountDefault: number
  ) {
    return Tx.contractCall(
      this.name,
      "set-city-coinbase-amounts",
      [
        types.uint(cityId),
        types.uint(amountBonus),
        types.uint(amount1),
        types.uint(amount2),
        types.uint(amount3),
        types.uint(amount4),
        types.uint(amount5),
        types.uint(amountDefault),
      ],
      sender.address
    );
  }

  // Read only functions

  isCityActivated(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("is-city-activated", [types.uint(cityId)]);
  }

  getCityActivationDetails(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-activation-details", [
      types.uint(cityId),
    ]);
  }

  getCityActivationSignals(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-activation-signals", [
      types.uint(cityId),
    ]);
  }

  getCityActivationVoter(cityId: number, signaler: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-activation-voter", [
      types.uint(cityId),
      types.principal(signaler),
    ]);
  }

  getCityTreasuryNonce(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-treasury-nonce", [types.uint(cityId)]);
  }

  getCityTreasuryId(cityId: number, treasuryName: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-treasury-id", [
      types.uint(cityId),
      types.ascii(treasuryName),
    ]);
  }

  getCityTreasuryName(cityId: number, treasuryId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-treasury-name", [
      types.uint(cityId),
      types.uint(treasuryId),
    ]);
  }

  getCityTreasuryAddress(cityId: number, treasuryId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-treasury-address", [
      types.uint(cityId),
      types.uint(treasuryId),
    ]);
  }

  getCityTokenContractNonce(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-token-contract-nonce", [
      types.uint(cityId),
    ]);
  }

  getCityTokenContractId(cityId: number, tokenAddress: string): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-token-contract-id", [
      types.uint(cityId),
      types.principal(tokenAddress),
    ]);
  }

  getCityTokenContractAddress(cityId: number, tokenId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-token-contract-address", [
      types.uint(cityId),
      types.uint(tokenId),
    ]);
  }

  getActiveCityTokenContract(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-active-city-token-contract", [
      types.uint(cityId),
    ]);
  }

  getCityCoinbaseThresholds(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-coinbase-thresholds", [
      types.uint(cityId),
    ]);
  }

  getCityCoinbaseAmounts(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-coinbase-amounts", [
      types.uint(cityId),
    ]);
  }

  getCityCoinbaseBonusPeriod(cityId: number): ReadOnlyFn {
    return this.callReadOnlyFn("get-city-coinbase-bonus-period", [
      types.uint(cityId),
    ]);
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
