import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import {
  constructAndPassProposal,
  passProposal,
  PROPOSALS,
} from "../../utils/common.ts";
import { CCD004CityRegistry } from "../../models/extensions/ccd004-city-registry.model.ts";
import { BaseDao } from "../../models/base-dao.model.ts";
import { EXTENSIONS } from "../../utils/common.ts";

// Authorization checks

Clarinet.test({
  name: "ccd004-city-registry: is-dao-or-extenion() fails when called directly",
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

/*

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() fails when called directly",
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
      ccd004CityRegistry.getOrCreateCityId(sender, sender.address),
    ]);

    console.log(JSON.stringify(receipts, null, 2));

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD004CityRegistry.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-...() return none for unknown values",
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
    ccd004CityRegistry.getUserId(sender.address).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-user() returns none for unknown user id",
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
    ccd004CityRegistry.getUser(1).result.expectNone();
  },
});

// Internal DAO functions

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() can be called if the user registry extension is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const approver1 = accounts.get("wallet_1")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );
    const baseDao = new BaseDao(chain, sender);

    // act
    // disables user registry extension
    let receipts = constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD003_USER_REGISTRY_002
    );
    baseDao
      .isExtension(EXTENSIONS.CCD003_USER_REGISTRY)
      .result.expectBool(false);
    // try to create an id - should fail but passes
    receipts = passProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD003_USER_REGISTRY_001
    );

    // assert
    assertEquals(receipts.length, 3);
    receipts[2].result.expectOk().expectUint(3); // numb signals - not the result of execution!
    ccd004CityRegistry
      .getUser(1)
      .result.expectSome()
      .expectPrincipal(approver1.address);
    ccd004CityRegistry
      .getUserId(approver1.address)
      .result.expectSome()
      .expectUint(1);
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() creates an entry for id=1",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const approver1 = accounts.get("wallet_1")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );

    // act
    const receipts = constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD003_USER_REGISTRY_001
    );

    // assert
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk().expectUint(3); // numb signals - not the result of execution!
    ccd004CityRegistry
      .getUser(1)
      .result.expectSome()
      .expectPrincipal(approver1.address);
    ccd004CityRegistry
      .getUserId(approver1.address)
      .result.expectSome()
      .expectUint(1);
    ccd004CityRegistry.getUser(2).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd004-city-registry: get-or-create-city-id() increments the user id nonce",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const approver1 = accounts.get("wallet_1")!;
    const approver2 = accounts.get("wallet_2")!;
    const approver3 = accounts.get("wallet_3")!;
    const ccd004CityRegistry = new CCD004CityRegistry(
      chain,
      sender,
      "ccd004-city-registry"
    );

    // act
    const receipts = constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD003_USER_REGISTRY_003
    );

    // assert
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk().expectUint(3); // numb signals - not the result of execution!
    ccd004CityRegistry
      .getUser(1)
      .result.expectSome()
      .expectPrincipal(approver1.address);
    ccd004CityRegistry
      .getUserId(approver1.address)
      .result.expectSome()
      .expectUint(1);
    ccd004CityRegistry
      .getUser(2)
      .result.expectSome()
      .expectPrincipal(approver2.address);
    ccd004CityRegistry
      .getUserId(approver2.address)
      .result.expectSome()
      .expectUint(2);
    ccd004CityRegistry
      .getUser(3)
      .result.expectSome()
      .expectPrincipal(approver3.address);
    ccd004CityRegistry
      .getUserId(approver3.address)
      .result.expectSome()
      .expectUint(3);
  },
});

*/
