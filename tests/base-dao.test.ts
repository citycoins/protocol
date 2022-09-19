import { Account, assertEquals, Clarinet, Chain } from "../utils/deps.ts";
import { BaseDao } from "../models/base-dao.model.ts";
import { BASE_DAO, PROPOSALS } from "../utils/common.ts";

const baseDao = new BaseDao();

Clarinet.test({
  name: "base-dao: succeeds when initializing the DAO with bootstrap proposal",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const sender = accounts.get("deployer")!;
    const { receipts } = chain.mineBlock([
      baseDao.construct(sender, PROPOSALS.CCIP_012),
    ]);

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
    const sender = accounts.get("deployer")!;
    const { receipts } = chain.mineBlock([
      baseDao.construct(sender, PROPOSALS.CCIP_012),
      baseDao.construct(sender, PROPOSALS.CCIP_012),
    ]);

    assertEquals(receipts.length, 2);
    receipts[1].result.expectErr().expectUint(BaseDao.ErrCode.ERR_UNAUTHORIZED);
  },
});
