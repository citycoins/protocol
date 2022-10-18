import { Account, assertEquals, Clarinet, Chain } from "../utils/deps.ts";
import { BaseDao } from "../models/base-dao.model.ts";
import { BASE_DAO, EXTENSIONS, PROPOSALS } from "../utils/common.ts";

// Extensions

Clarinet.test({
  name: "base-dao: is-extension() succeeds and returns false with unrecognized extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("deployer")!;
    chain.mineEmptyBlockUntil(100);

    // act
    const { receipts } = chain.mineBlock([
      baseDao.isExtension(sender, EXTENSIONS.CCD001_DIRECT_EXECUTE),
      baseDao.isExtension(sender, EXTENSIONS.CCD002_TREASURY_MIA),
      baseDao.isExtension(sender, EXTENSIONS.CCD002_TREASURY_NYC),
    ]);

    // assert
    assertEquals(receipts.length, 3);
    for (const receipt of receipts) {
      receipt.result.expectBool(false);
    }
  },
});

Clarinet.test({
  name: "base-dao: is-extension() succeeds and returns true for active extensions",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("deployer")!;
    chain.mineEmptyBlockUntil(100);
    chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012)]);

    // act
    const { receipts } = chain.mineBlock([
      baseDao.isExtension(sender, EXTENSIONS.CCD001_DIRECT_EXECUTE),
      baseDao.isExtension(sender, EXTENSIONS.CCD002_TREASURY_MIA),
      baseDao.isExtension(sender, EXTENSIONS.CCD002_TREASURY_NYC),
    ]);

    // assert
    assertEquals(receipts.length, 3);
    for (const receipt of receipts) {
      receipt.result.expectBool(true);
    }
  },
});

Clarinet.test({
  name: "base-dao: set-extension() fails if caller is not DAO or extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("wallet_1")!;

    // act
    const { receipts } = chain.mineBlock([
      baseDao.setExtension(sender, {
        extension: EXTENSIONS.CCD001_DIRECT_EXECUTE,
        enabled: true,
      }),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(BaseDao.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "base-dao: set-extensions() fails if caller is not DAO or extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("wallet_1")!;
    const extensions = [
      { extension: EXTENSIONS.CCD001_DIRECT_EXECUTE, enabled: true },
      { extension: EXTENSIONS.CCD002_TREASURY_MIA, enabled: true },
      { extension: EXTENSIONS.CCD002_TREASURY_NYC, enabled: true },
    ];

    // act
    const { receipts } = chain.mineBlock([
      baseDao.setExtensions(sender, extensions),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(BaseDao.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Proposals

Clarinet.test({
  name: "base-dao: executed-at() succeeds and returns the block height the proposal was executed",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("deployer")!;
    const targetBlock = 100;
    chain.mineEmptyBlockUntil(targetBlock);
    chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012)]);

    // act
    const { receipts } = chain.mineBlock([
      baseDao.executedAt(sender, PROPOSALS.CCIP_012),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    for (const receipt of receipts) {
      receipt.result.expectSome().expectUint(targetBlock);
    }
  },
});

Clarinet.test({
  name: "base-dao: executed-at() succeeds and returns none with unrecognized proposal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("deployer")!;
    chain.mineEmptyBlockUntil(100);

    // act
    const { receipts } = chain.mineBlock([
      baseDao.executedAt(sender, PROPOSALS.CCIP_012),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    for (const receipt of receipts) {
      receipt.result.expectNone();
    }
  },
});

Clarinet.test({
  name: "base-dao: execute() fails if caller is not DAO or extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      baseDao.execute(sender, PROPOSALS.CCIP_012, sender.address),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(BaseDao.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Bootstrap

Clarinet.test({
  name: "base-dao: construct() fails when initializing the DAO with bootstrap proposal a second time",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      baseDao.construct(sender, PROPOSALS.CCIP_012),
      baseDao.construct(sender, PROPOSALS.CCIP_012),
    ]);

    // assert
    assertEquals(receipts.length, 2);
    receipts[0].result.expectOk().expectBool(true);
    receipts[1].result.expectErr().expectUint(BaseDao.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "base-dao: construct() fails when called by an account that is not the deployer",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("wallet_1")!;

    // act
    const { receipts } = chain.mineBlock([
      baseDao.construct(sender, PROPOSALS.CCIP_012),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(BaseDao.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "base-dao: construct() succeeds when initializing the DAO with bootstrap proposal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      baseDao.construct(sender, PROPOSALS.CCIP_012),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);

    const expectedPrintEvents = [
      '{event: "execute", proposal: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccip012-bootstrap}',
      '{enabled: true, event: "extension", extension: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd001-direct-execute}',
      '{enabled: true, event: "extension", extension: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-mia}',
      '{enabled: true, event: "extension", extension: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-nyc}',
      '"CityCoins DAO has risen! Our mission is to empower people to take ownership in their city by transforming citizens into stakeholders with the ability to fund, build, and vote on meaningful upgrades to their communities."',
    ];
    const brokenReceiptEvent = receipts[0].events[4].contract_event.value;
    const brokenPrintEvent = expectedPrintEvents[4];
    for (const event of expectedPrintEvents) {
      if (event === brokenPrintEvent) {
        assertEquals(brokenReceiptEvent, event);
        continue;
      }
      receipts[0].events.expectPrintEvent(BASE_DAO, event);
    }
  },
});

// Extension requests

Clarinet.test({
  name: "base-dao: request-extension-callback() fails if caller is not an extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const baseDao = new BaseDao();
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      baseDao.requestExtensionCallback(
        sender,
        EXTENSIONS.CCD001_DIRECT_EXECUTE,
        "test"
      ),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(BaseDao.ErrCode.ERR_INVALID_EXTENSION);
  },
});
