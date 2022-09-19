import { Account, assertEquals, Clarinet, Chain } from "../utils/deps.ts";
import { BaseDao } from "../models/base-dao.model.ts";
import { BASE_DAO, EXTENSIONS, PROPOSALS } from "../utils/common.ts";

const baseDao = new BaseDao();

Clarinet.test({
  name: "base-dao: succeeds when initializing the DAO with bootstrap proposal",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
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

Clarinet.test({
  name: "base-dao: fails when initializing the DAO with bootstrap proposal a second time",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
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
  name: "base-dao: succeeds and returns active extensions",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
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
  name: "base-dao: succeeds and returns false with unrecognized extension",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
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
  name: "base-dao: succeeds and returns the block height the proposal was executed",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
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
  name: "base-dao: succeeds and returns none with unrecognized proposal",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
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
