import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS } from "../../utils/common.ts";
import { BaseDao } from "../../models/base-dao.model.ts";
import { CCD004CityRegistry } from "../../models/extensions/ccd004-city-registry.model.ts";

// PUBLIC FUNCTIONS

Clarinet.test({
  name: "ccd004-city-registry: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(chain, sender, "ccd004-city-registry");

    // assert
    ccd004CityRegistry.isDaoOrExtension().result.expectErr().expectUint(CCD004CityRegistry.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(chain, sender, "ccd004-city-registry");

    // act
    const { receipts } = chain.mineBlock([ccd004CityRegistry.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(chain, sender, "ccd004-city-registry");

    // act
    const { receipts } = chain.mineBlock([ccd004CityRegistry.getOrCreateCityId(sender, "mia")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD004CityRegistry.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() fails if executed more than once from the same proposal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // act
    let receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    receipts = passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);

    // assert
    assertEquals(receipts.length, 3);
    receipts[2].result.expectErr().expectUint(BaseDao.ErrCode.ERR_ALREADY_EXECUTED);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() succeeds and returns the city id if the city already exists",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // act
    let receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    receipts = passProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_002);

    // assert
    assertEquals(receipts.length, 3);
    // this returns the number of signals - the actual return value is consumed by base dao
    receipts[2].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() succeeds and increments the city id nonce",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(chain, sender, "ccd004-city-registry");

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);

    // assert
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk().expectUint(3); // numb signals - not the result of execution!
    ccd004CityRegistry.getCityName(1).result.expectSome().expectAscii("mia");
    ccd004CityRegistry.getCityId("mia").result.expectSome().expectUint(1);
    ccd004CityRegistry.getCityName(2).result.expectSome().expectAscii("nyc");
    ccd004CityRegistry.getCityId("nyc").result.expectSome().expectUint(2);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() succeeds and creates a city entry",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(chain, sender, "ccd004-city-registry");

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);

    // assert
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk().expectUint(3); // numb signals - not the result of execution!
    ccd004CityRegistry.getCityName(1).result.expectSome().expectAscii("mia");
    ccd004CityRegistry.getCityId("mia").result.expectSome().expectUint(1);
  },
});

// READ ONLY FUNCTIONS

Clarinet.test({
  name: "ccd004-city-registry: get-city-id() succeeds and returns none if city id is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(chain, sender, "ccd004-city-registry");

    // assert
    ccd004CityRegistry.getCityId("mia").result.expectNone();
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-city-name() succeeds and returns none if city id is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd004CityRegistry = new CCD004CityRegistry(chain, sender, "ccd004-city-registry");

    // assert
    ccd004CityRegistry.getCityName(1).result.expectNone();
  },
});
