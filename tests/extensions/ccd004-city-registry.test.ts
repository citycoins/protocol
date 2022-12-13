import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import {
  constructAndPassProposal,
  passProposal,
  PROPOSALS,
} from "../../utils/common.ts";
import { BaseDao } from "../../models/base-dao.model.ts";
import { CCD004CityRegistry } from "../../models/extensions/ccd004-city-registry.model.ts";

// Authorization checks

Clarinet.test({
  name: "ccd004-city-registry: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );

    // act

    // assert
    ccd004CityRegistry
      .isDaoOrExtension()
      .result.expectErr()
      .expectUint(CCD004CityRegistry.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() fails if not called by the base dao or by a valid extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );

    // act
    const { receipts } = chain.mineBlock([
      ccd004CityRegistry.getOrCreateCityId(sender, "mia"),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD004CityRegistry.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-city-name() return none for unknown city name",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );

    // act

    // assert
    ccd004CityRegistry.getCityName(1).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-city-id() return none for unknown city id",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );

    // act

    // assert
    ccd004CityRegistry.getCityId("mia").result.expectNone();
  },
});

// Internal DAO functions

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() cannot be executed more than once from the same proposal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // act
    let receipts = constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD004_CITY_REGISTRY_001
    );
    receipts = passProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD004_CITY_REGISTRY_001
    );

    // assert
    assertEquals(receipts.length, 3);
    receipts[2].result
      .expectErr()
      .expectUint(BaseDao.ErrCode.ERR_ALREADY_EXECUTED);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() creates an entry",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );

    // act
    const receipts = constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD004_CITY_REGISTRY_001
    );

    // assert
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk().expectUint(3); // numb signals - not the result of execution!
    ccd004CityRegistry.getCityName(1).result.expectSome().expectAscii("mia");
    ccd004CityRegistry.getCityId("mia").result.expectSome().expectUint(1);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() increments the city id nonce",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );

    // act
    const receipts = constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD004_CITY_REGISTRY_001
    );

    // assert
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk().expectUint(3); // numb signals - not the result of execution!
    ccd004CityRegistry.getCityName(1).result.expectSome().expectAscii("mia");
    ccd004CityRegistry.getCityId("mia").result.expectSome().expectUint(1);
    ccd004CityRegistry.getCityName(2).result.expectSome().expectAscii("nyc");
    ccd004CityRegistry.getCityId("nyc").result.expectSome().expectUint(2);
  },
});
