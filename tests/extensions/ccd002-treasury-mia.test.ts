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

// Deposit functions

// ccd002-treasury-mia: deposit-stx() succeeds and transfers STX to the vault
// ccd002-treasury-mia: deposit-ft() succeeds and transfers FT to the vault
// ccd002-treasury-mia: deposit-nft() succeeds and transfers NFT to the vault

// Withdraw functions

// ccd002-treasury-mia: withdraw-stx() fails when called directly
// ccd002-treasury-mia: withdraw-stx() succeeds and transfers STX to recipient
// ccd002-treasury-mia: withdraw-ft() fails when called directly
// ccd002-treasury-mia: withdraw-ft() fails if asset is not whitelisted
// ccd002-treasury-mia: withdraw-ft() succeeds and transfers FT to recipient
// ccd002-treasury-mia: withdraw-nft() fails when called directly
// ccd002-treasury-mia: withdraw-nft() fails if asset is not whitelisted
// ccd002-treasury-mia: withdraw-nft() succeeds and transfers NFT to recipient

// Read only functions

// ccd002-treasury-mia: is-whitelisted() succeeds and returns false if asset is not in map
// ccd002-treasury-mia: is-whitelisted() succeeds and returns true if asset is found in map
// ccd002-treasury-mia: get-whitelisted-asset() succeeds and returns none if asset is not in map
// ccd002-treasury-mia: get-whitelisted-asset() succeeds and returns tuple if asset is found in map
// ccd002-treasury-mia: get-balance-stx() succeeds and returns STX balance of the vault

// Extension callback

// ccd002-treasury-mia: callback() succeeds when called directly
