import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import {
  constructAndPassProposal,
  passProposal,
  PROPOSALS,
} from "../../utils/common.ts";
import { CCD005CityData } from "../../models/extensions/ccd005-city-data.model.ts";

// Authorization checks

Clarinet.test({
  name: "ccd005-city-data: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act

    // assert
    ccd005CityData
      .isDaoOrExtension()
      .result.expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});

// CITY ACTIVATION TESTS

Clarinet.test({
  name: "ccd005-city-data: set-city-activation-status() generates an error if city is undefined",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    const { receipts } = chain.mineBlock([
      ccd005CityData.setCityActivationStatus(sender, 1, true),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});
Clarinet.test({
  name: "ccd005-city-data: set-city-activation-status() cannot be called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );

    // act
    const { receipts } = chain.mineBlock([
      ccd005CityData.setCityActivationStatus(sender, 1, true),
    ]);

    // assert
    ccd005CityData.getCityActivationDetails(1).result.expectNone();
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD005CityData.ErrCode.ERR_UNAUTHORIZED);
  },
});
