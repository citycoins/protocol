import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { CCD002TreasuryNyc } from "../../models/extensions/ccd002-treasury.model.ts";

const ccd002TreasuryNyc = new CCD002TreasuryNyc();

// Authorization check

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

// Internal DAO functions

// ccd002-treasury-nyc: set-whitelist() fails when called directly
// ccd002-treasury-nyc: set-whitelists() fails when called directly

// Deposit functions

// ccd002-treasury-nyc: deposit-stx() succeeds and transfers STX to the vault
// ccd002-treasury-nyc: deposit-ft() succeeds and transfers FT to the vault
// ccd002-treasury-nyc: deposit-nft() succeeds and transfers NFT to the vault

// Withdraw functions

// ccd002-treasury-nyc: withdraw-stx() fails when called directly
// ccd002-treasury-nyc: withdraw-stx() succeeds and transfers STX to recipient
// ccd002-treasury-nyc: withdraw-ft() fails when called directly
// ccd002-treasury-nyc: withdraw-ft() fails if asset is not whitelisted
// ccd002-treasury-nyc: withdraw-ft() succeeds and transfers FT to recipient
// ccd002-treasury-nyc: withdraw-nft() fails when called directly
// ccd002-treasury-nyc: withdraw-nft() fails if asset is not whitelisted
// ccd002-treasury-nyc: withdraw-nft() succeeds and transfers NFT to recipient

// Read only functions

// ccd002-treasury-nyc: is-whitelisted() succeeds and returns false if asset is not in map
// ccd002-treasury-nyc: is-whitelisted() succeeds and returns true if asset is found in map
// ccd002-treasury-nyc: get-whitelisted-asset() succeeds and returns none if asset is not in map
// ccd002-treasury-nyc: get-whitelisted-asset() succeeds and returns tuple if asset is found in map
// ccd002-treasury-nyc: get-balance-stx() succeeds and returns STX balance of the vault

// Extension callback

// ccd002-treasury-nyc: callback() succeeds when called directly
