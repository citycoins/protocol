import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { CCD002TreasuryMia } from "../../models/extensions/ccd002-treasury.model.ts";

const ccd002TreasuryMia = new CCD002TreasuryMia();

// Authorization check

Clarinet.test({
  name: "ccd002-treasury-mia: is-dao-or-extenion() fails when called directly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd002TreasuryMia.isDaoOrExtension(sender),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002TreasuryMia.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Internal DAO functions

// ccd002-treasury-mia: set-whitelist() fails when called directly
// ccd002-treasury-mia: set-whitelists() fails when called directly
