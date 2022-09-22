import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { BASE_DAO, EXTENSIONS, PROPOSALS } from "../../utils/common.ts";
import { CCD002TreasuryNyc } from "../../models/extensions/ccd002-treasury.model.ts";

const ccd002TreasuryNyc = new CCD002TreasuryNyc();

Clarinet.test({
  name: "ccd002-treasury-nyc: is-dao-or-extenion() fails when called directly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd002TreasuryNyc.isDaoOrExtension(sender),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002TreasuryNyc.ErrCode.ERR_UNAUTHORIZED);
  },
});
