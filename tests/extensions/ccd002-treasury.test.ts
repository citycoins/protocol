import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { CCD002Treasury } from "../../models/extensions/ccd002-treasury.model.ts";
import { EXTENSIONS, EXTERNAL } from "../../utils/common.ts";

// Authorization check

Clarinet.test({
  name: "ccd002-treasury: is-dao-or-extenion() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.isDaoOrExtension(sender),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Internal DAO functions

// ccd002-treasury: set-allowed() fails when called directly
Clarinet.test({
  name: "ccd002-treasury: set-allowed() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.setAllowed(sender, {
        token: EXTERNAL.FT_MIA,
        enabled: true,
      }),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

// ccd002-treasury: set-allowed() succeeds and adds a contract principal

// ccd002-treasury: set-allowed-list() fails when called directly
Clarinet.test({
  name: "ccd002-treasury: set-allowed-list() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;
    const assetList = [
      {
        token: EXTERNAL.FT_MIA,
        enabled: true,
      },
      {
        token: EXTERNAL.FT_NYC,
        enabled: true,
      },
    ];

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.setAllowedList(sender, assetList),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

// ccd002-treasury: set-allowed-list() succeeds and adds contract principals

// Deposit functions

// ccd002-treasury: deposit-stx() succeeds and transfers STX to the vault
Clarinet.test({
  name: "ccd002-treasury: deposit-stx() succeeds and transfers STX to the vault",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;
    const amount = 1000;
    const event =
      '{amount: u1000, caller: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM, event: "deposit-stx", recipient: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury, sender: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM}';

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.depositStx(sender, amount),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
    receipts[0].events.expectSTXTransferEvent(
      amount,
      sender.address,
      EXTENSIONS.CCD002_TREASURY
    );
    receipts[0].events.expectPrintEvent(EXTENSIONS.CCD002_TREASURY, event);
  },
});

// ccd002-treasury: deposit-ft() fails if asset is not allowed
// ccd002-treasury: deposit-ft() succeeds and transfers FT to the vault
// ccd002-treasury: deposit-nft() fails if asset is not allowed
// ccd002-treasury: deposit-nft() succeeds and transfers NFT to the vault

// Withdraw functions

// ccd002-treasury: withdraw-stx() fails when called directly
Clarinet.test({
  name: "ccd002-treasury: withdraw-stx() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;
    const amount = 1000;

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.withdrawStx(sender, amount, sender.address),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

// ccd002-treasury: withdraw-stx() succeeds and transfers STX to recipient

// ccd002-treasury: withdraw-ft() fails when called directly

/* need MIA token contract first
Clarinet.test({
  name: "ccd002-treasury: withdraw-ft() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;
    const amount = 1000;
    const asset = EXTERNAL.FT_MIA;

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.withdrawFt(sender, asset, amount, sender.address),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});
*/

// ccd002-treasury: withdraw-ft() fails if asset is not allowed
// ccd002-treasury: withdraw-ft() succeeds and transfers FT to recipient
// ccd002-treasury: withdraw-nft() fails when called directly
// ccd002-treasury: withdraw-nft() fails if asset is not allowed
// ccd002-treasury: withdraw-nft() succeeds and transfers NFT to recipient

// Read only functions

// ccd002-treasury: is-allowed() succeeds and returns false if asset is not in map
Clarinet.test({
  name: "ccd002-treasury: is-allowed() succeeds and returns false if asset is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;
    const asset = EXTERNAL.FT_MIA;

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.isAllowed(sender, asset),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectBool(false);
  },
});

// ccd002-treasury: is-allowed() succeeds and returns true if asset is found in map

// ccd002-treasury: get-allowed-asset() succeeds and returns none if asset is not in map
Clarinet.test({
  name: "ccd002-treasury: get-allowed-asset() succeeds and returns none if asset is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;
    const asset = EXTERNAL.FT_MIA;

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.getAllowedAsset(sender, asset),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectNone();
  },
});

// ccd002-treasury: get-allowed-asset() succeeds and returns tuple if asset is found in map
// ccd002-treasury: get-balance-stx() succeeds and returns STX balance of the vault

// Extension callback

// ccd002-treasury: callback() succeeds when called directly
Clarinet.test({
  name: "ccd002-treasury: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const ccd002Treasury = new CCD002Treasury();
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.callback(sender, "test"),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});
