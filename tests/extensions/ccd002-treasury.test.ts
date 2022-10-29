import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { EXTENSIONS, EXTERNAL } from "../../utils/common.ts";
import { PROPOSALS } from "../../utils/common.ts";
import { BaseDao } from "../../models/base-dao.model.ts";
import { CCD002Treasury } from "../../models/extensions/ccd002-treasury.model.ts";
import { CCD001DirectExecute } from "../../models/extensions/ccd001-direct-execute.model.ts";
import { CCEXTGovernanceToken } from "../../models/external/ccext-governance-token.model.ts";

const constructAndPassProposal = (chain: Chain, accounts: Map<string, Account>, proposal: string): any => {
  const sender = accounts.get("deployer")!;
  const baseDao = new BaseDao(chain, sender);
  const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
  const approver1 = accounts.get("wallet_1")!;
  const approver2 = accounts.get("wallet_2")!;
  const approver3 = accounts.get("wallet_3")!;
  const { receipts } = chain.mineBlock([
    baseDao.construct(sender, PROPOSALS.CCIP_012),
    ccd001DirectExecute.directExecute(approver1, proposal),
    ccd001DirectExecute.directExecute(approver2, proposal),
    ccd001DirectExecute.directExecute(approver3, proposal),
  ]);
  return receipts;
}

const passProposal = (chain: Chain, accounts: Map<string, Account>, proposal: string): any => {
  const sender = accounts.get("deployer")!;
  const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
  const approver1 = accounts.get("wallet_1")!;
  const approver2 = accounts.get("wallet_2")!;
  const approver3 = accounts.get("wallet_3")!;
  const { receipts } = chain.mineBlock([
    ccd001DirectExecute.directExecute(approver1, proposal),
    ccd001DirectExecute.directExecute(approver2, proposal),
    ccd001DirectExecute.directExecute(approver3, proposal),
  ]);
  return receipts;
}


// Authorization check

Clarinet.test({
  name: "ccd002-treasury: is-dao-or-extenion() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');

    // act

    // assert
    ccd002Treasury.isDaoOrExtension().result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED)
  }
});

// Internal DAO functions

// ccd002-treasury: set-allowed() fails when called directly
Clarinet.test({
  name: "ccd002-treasury: set-allowed() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.setAllowed(sender, {
        token: EXTERNAL.FT_MIA,
        enabled: true,
      })
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  }
});

Clarinet.test({
  name: "ccd002-treasury: set-allowed() succeeds and adds a contract principal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_001);

    // act

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result
      .expectOk()
      .expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
  }
});

// ccd002-treasury: set-allowed-list() fails when called directly
Clarinet.test({
  name: "ccd002-treasury: set-allowed-list() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
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

/**
 * Pre-conditions check that none is returned before the proposal is executed.
 * The proposal adds two asset contracts, one allowed the other denied.
 */
Clarinet.test({
  name: "ccd002-treasury: set-allowed-list() succeeds and adds contract principals",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectNone();
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectNone();

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_002);

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result
      .expectOk()
      .expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectSome().expectBool(true);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectSome().expectBool(false);
  }
});

/**
 * Pre-conditions check that none is returned before the proposal is executed.
 * The proposal adds two asset contracts, one allowed the other denied.
 */
 Clarinet.test({
  name: "ccd002-treasury: set-allowed-list() succeeds and adds contract principals",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectNone();
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectNone();

    // act
    const receipts = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_002);

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result
      .expectOk()
      .expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectSome().expectBool(true);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectSome().expectBool(false);
  }
});

/**
 * Pre-conditions run proposal 002 which adds two asset contracts.
 * The test runs proposal 003 which toggles the state of the two asset contracts
 */
 Clarinet.test({
  name: "ccd002-treasury: set-allowed-list() succeeds and toggles the state of the asset contracts",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const approver1 = accounts.get("wallet_1")!;
    const approver2 = accounts.get("wallet_2")!;
    const approver3 = accounts.get("wallet_3")!;
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectNone();
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectNone();
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_002);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectSome().expectBool(true);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectSome().expectBool(false);

    // act
    chain.mineBlock([
      ccd001DirectExecute.directExecute(approver1, PROPOSALS.TEST_CCD002_TREASURY_003),
      ccd001DirectExecute.directExecute(approver2, PROPOSALS.TEST_CCD002_TREASURY_003),
      ccd001DirectExecute.directExecute(approver3, PROPOSALS.TEST_CCD002_TREASURY_003),
    ]);

    // assert
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(false);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(true);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectSome().expectBool(false);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectSome().expectBool(true);
  }
});

// Deposit functions

Clarinet.test({
  name: "ccd002-treasury: deposit-stx() succeeds and transfers STX to the vault",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const amount = 1000;
    const event =
      '{amount: u1000, caller: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM, event: "deposit-stx", recipient: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-mia, sender: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM}';

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
      EXTENSIONS.CCD002_TREASURY_MIA
    );
    receipts[0].events.expectPrintEvent(EXTENSIONS.CCD002_TREASURY_MIA, event);
  },
});

Clarinet.test({
  name: "ccd002-treasury: deposit-ft() fails if asset is unknown",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const amount = 1000;

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.depositFt(sender, EXTERNAL.FT_MIA, amount),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_ASSET_NOT_ALLOWED);
  }
});

/**
 * Pre-conditions check that none is returned before the proposal is executed.
 * The proposal adds two asset contracts, one allowed the other denied.
 */
 Clarinet.test({
  name: "ccd002-treasury: deposit-ft() fails if asset is not allowed",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const amount = 1000;
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_002);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);

    // act
    const block = chain.mineBlock([
      ccd002Treasury.depositFt(sender, EXTERNAL.FT_NYC, amount)
    ]);

    // assert
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_ASSET_NOT_ALLOWED);
  }
});

/**
 * Setup: 
 * 1. construct dao and allow list a sip 10 token contract
 * 2. Dao mints token to user
 * 3. User transfers token to treasury
 */
Clarinet.test({
  name: "ccd002-treasury: deposit-ft() succeeds and transfers FT to the vault",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const depositor = accounts.get("wallet_6")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const gt = new CCEXTGovernanceToken(chain, sender, 'ccext-governance-token-mia');
    const amount = 1000;
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_002);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_004);
    gt.getBalance(depositor.address).result.expectOk().expectUint(2000);
    const event =
      '{amount: u1000, assetContract: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccext-governance-token-mia, caller: ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0, event: "deposit-ft", recipient: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-mia, sender: ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0}';
  
    // act
    const {receipts} = chain.mineBlock([
      ccd002Treasury.depositFt(depositor, EXTERNAL.FT_MIA, amount)
    ]);

    // assert
    assertEquals(receipts.length, 1);
    gt.getBalance(depositor.address).result.expectOk().expectUint(1000);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA).result.expectOk().expectUint(1000);
    receipts[0].result
      .expectOk()
      .expectBool(true);
    receipts[0].events.expectFungibleTokenTransferEvent(
      1000,
      depositor.address,
      EXTENSIONS.CCD002_TREASURY_MIA,
      EXTERNAL.FT_MIA + '::edg-token',
    );
    receipts[0].events.expectPrintEvent(EXTENSIONS.CCD002_TREASURY_MIA, event);
  }
});

 Clarinet.test({
  name: "ccd002-treasury: deposit-nft() fails if asset is not allowed",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const amount = 1000;
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_002);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);

    // act
    const block = chain.mineBlock([
      ccd002Treasury.depositFt(sender, EXTERNAL.FT_NYC, amount)
    ]);

    // assert
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result
      .expectErr()
      .expectUint(CCD002Treasury.ErrCode.ERR_ASSET_NOT_ALLOWED);
  }
});































// ccd002-treasury: deposit-nft() succeeds and transfers NFT to the vault

// Withdraw functions

// ccd002-treasury: withdraw-stx() fails when called directly
Clarinet.test({
  name: "ccd002-treasury: withdraw-stx() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
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
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const asset = EXTERNAL.FT_MIA;

    // act

    // assert
    ccd002Treasury.isAllowed(asset).result.expectBool(false)
  },
});

// ccd002-treasury: is-allowed() succeeds and returns true if asset is found in map

Clarinet.test({
  name: "ccd002-treasury: get-allowed-asset() succeeds and returns none if asset is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');
    const asset = EXTERNAL.FT_MIA;

    // act

    // assert
    ccd002Treasury.getAllowedAsset(asset).result.expectNone()
  }
});

// ccd002-treasury: get-allowed-asset() succeeds and returns tuple if asset is found in map
// ccd002-treasury: get-balance-stx() succeeds and returns STX balance of the vault

// Extension callback

// ccd002-treasury: callback() succeeds when called directly
Clarinet.test({
  name: "ccd002-treasury: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, 'ccd002-treasury-mia');

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.callback(sender, "test"),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});
