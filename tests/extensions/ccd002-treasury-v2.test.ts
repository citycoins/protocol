import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { constructAndPassProposal, passProposal, EXTENSIONS, EXTERNAL, PROPOSALS } from "../../utils/common.ts";
import { CCD002Treasury, PoxAddress } from "../../models/extensions/ccd002-treasury.model.ts";
import { CCEXTGovernanceToken } from "../../models/external/test-ccext-governance-token.model.ts";
import { CCEXTNft } from "../../models/external/test-ccext-nft.model.ts";

// PUBLIC FUNCTIONS

Clarinet.test({
  name: "ccd002-treasury: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");

    // assert
    ccd002Treasury.isDaoOrExtension().result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd002-treasury: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");

    // act
    const { receipts } = chain.mineBlock([ccd002Treasury.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd002-treasury: set-allowed() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");

    // act
    const { receipts } = chain.mineBlock([
      ccd002Treasury.setAllowed(sender, {
        token: EXTERNAL.FT_MIA,
        enabled: true,
      }),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd002-treasury: set-allowed() succeeds and adds a contract principal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");

    // act
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_001);

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result.expectOk().expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
  },
});

Clarinet.test({
  name: "ccd002-treasury: set-allowed-list() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
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
    const { receipts } = chain.mineBlock([ccd002Treasury.setAllowedList(sender, assetList)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd002-treasury: set-allowed-list() succeeds and adds contract principals",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectNone();
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectNone();

    // act
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_002);

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result.expectOk().expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectSome().expectBool(true);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectSome().expectBool(false);
  },
});

Clarinet.test({
  name: "ccd002-treasury: set-allowed-list() succeeds and toggles the state of the asset contracts",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectNone();
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectNone();
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_002);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectSome().expectBool(true);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectSome().expectBool(false);

    // act
    // prop 3 toggles the state of a list of assets
    passProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_003);

    // assert
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(false);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(true);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_MIA).result.expectSome().expectBool(false);
    ccd002Treasury.getAllowedAsset(EXTERNAL.FT_NYC).result.expectSome().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd002-treasury: deposit-stx() succeeds and transfers STX to the vault",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const amount = 1000;
    const event = '{amount: u1000, caller: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM, event: "deposit-stx", recipient: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-mia-mining-v2, sender: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM}';

    // act
    const { receipts } = chain.mineBlock([ccd002Treasury.depositStx(sender, amount)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
    receipts[0].events.expectSTXTransferEvent(amount, sender.address, EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2);
    receipts[0].events.expectPrintEvent(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2, event);
  },
});

Clarinet.test({
  name: "ccd002-treasury: deposit-ft() fails if asset is not on allow list",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const amount = 1000;

    // act
    const { receipts } = chain.mineBlock([ccd002Treasury.depositFt(sender, EXTERNAL.FT_MIA, amount)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd002-treasury: deposit-ft() fails if asset is not enabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const amount = 1000;
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_002);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);

    // act
    const block = chain.mineBlock([ccd002Treasury.depositFt(sender, EXTERNAL.FT_NYC, amount)]);

    // assert
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd002-treasury: deposit-ft() succeeds and transfers FT to the vault",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const depositor = accounts.get("wallet_6")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const amount = 1000;
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_002);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
    // TEST_CCD002_TREASURY_004 mints 2000 MIA to wallet 6
    passProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_004);
    gt.getBalance(depositor.address).result.expectOk().expectUint(2000);
    const event = '{amount: u1000, assetContract: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-mia, caller: ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0, event: "deposit-ft", recipient: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-mia-mining-v2, sender: ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0}';

    // act
    const { receipts } = chain.mineBlock([ccd002Treasury.depositFt(depositor, EXTERNAL.FT_MIA, amount)]);

    // assert
    assertEquals(receipts.length, 1);
    gt.getBalance(depositor.address).result.expectOk().expectUint(1000);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2).result.expectOk().expectUint(1000);
    receipts[0].result.expectOk().expectBool(true);
    receipts[0].events.expectFungibleTokenTransferEvent(1000, depositor.address, EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2, EXTERNAL.FT_MIA + "::miamicoin");
    receipts[0].events.expectPrintEvent(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2, event);
  },
});

Clarinet.test({
  name: "ccd002-treasury: deposit-nft() fails if asset is not on allow list",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const tokenId = 1000;
    ccd002Treasury.isAllowed(EXTERNAL.NFT_NYC).result.expectBool(false);

    // act
    const block = chain.mineBlock([ccd002Treasury.depositNft(sender, EXTERNAL.NFT_NYC, tokenId)]);

    // assert
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd002-treasury: deposit-nft() fails if asset is not enabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const tokenId = 1000;
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_002);
    ccd002Treasury.isAllowed(EXTERNAL.NFT_NYC).result.expectBool(false);

    // act
    const block = chain.mineBlock([ccd002Treasury.depositNft(sender, EXTERNAL.NFT_NYC, tokenId)]);

    // assert
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd002-treasury: deposit-nft() succeeds and transfers NFT to the vault",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const depositor = accounts.get("wallet_6")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-mining-v2");
    const nft = new CCEXTNft(chain, sender, "test-ccext-nft-nyc");
    const tokenId = 1;
    // Enable NYC NFT asset contract
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_005);
    ccd002Treasury.isAllowed(EXTERNAL.NFT_NYC).result.expectBool(true);
    chain.mineBlock([nft.mint(depositor.address, sender.address)]);
    nft.getOwner(tokenId).result.expectOk().expectSome().expectPrincipal(depositor.address);
    const event = "{assetContract: " + EXTERNAL.NFT_NYC + ', caller: ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0, event: "deposit-nft", recipient: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-nyc-mining-v2, sender: ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0, tokenId: u1}';

    // act
    const { receipts } = chain.mineBlock([ccd002Treasury.depositNft(depositor, EXTERNAL.NFT_NYC, tokenId)]);

    // assert
    assertEquals(receipts.length, 1);
    nft.getOwner(tokenId).result.expectOk().expectSome().expectPrincipal(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2);
    receipts[0].result.expectOk().expectBool(true);
    receipts[0].events.expectNonFungibleTokenTransferEvent("u1", depositor.address, EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2, EXTERNAL.NFT_NYC, "nyc");
    receipts[0].events.expectPrintEvent(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2, event);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-stx() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const amount = 1000;

    // act
    const { receipts } = chain.mineBlock([ccd002Treasury.withdrawStx(sender, amount, sender.address)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-stx() succeeds and transfers STX to recipient",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const recipient = accounts.get("wallet_6")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const amount1 = 1000;
    const amount2 = 500;
    chain.mineBlock([ccd002Treasury.depositStx(sender, amount1)]);
    ccd002Treasury.getBalanceStx().result.expectUint(amount1);
    const event = '{amount: u500, caller: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccd002-treasury-v2-006, event: "withdraw-stx", recipient: ' + recipient.address + ", sender: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.base-dao}";

    // act
    // TEST_CCD002_TREASURY_006 calls the withdraw-stx of 500 stx to wallet_6
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_006);

    // assert
    ccd002Treasury.getBalanceStx().result.expectUint(amount2);
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk().expectUint(3); // number of signals - not result of withdraw-stx!
    receipts[3].events.expectSTXTransferEvent(amount2, EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2, recipient.address);
    receipts[3].events.expectPrintEvent(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2, event);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-ft() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const recipient = accounts.get("wallet_6")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-mining-v2");
    const amount = 1000;

    // act
    const block = chain.mineBlock([ccd002Treasury.withdrawFt(sender, EXTERNAL.FT_NYC, amount, recipient.address)]);

    // assert
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-ft() fails if asset is not on allow list",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-mining-v2");
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);

    // act
    // Proposal attempts to withdraw nyc coin
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_007);

    // assert
    assertEquals(receipts.length, 4);
    receipts[3].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-ft() fails if asset is not enabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-mining-v2");
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_002);
    ccd002Treasury.isAllowed(EXTERNAL.FT_NYC).result.expectBool(false);

    // act
    // Proposal attempts to withdraw nyc coin
    const { receipts } = passProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_007);

    // assert
    assertEquals(receipts.length, 3);
    receipts[2].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-ft() fails if withdrawal exceeds balance",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const recipient = accounts.get("wallet_6")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    gt.getBalance(recipient.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2).result.expectOk().expectUint(0);
    // Prop 8 allow lists MIA token, mints 2000 MIA to treasury and withdraws 500 to recipient
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_008);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
    gt.getBalance(recipient.address).result.expectOk().expectUint(500);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2).result.expectOk().expectUint(1500);

    // act
    // Prop 10 transfers 2000 mia tokens to recipient
    const { receipts } = passProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_010);

    // assert
    // check balances have not changed
    gt.getBalance(recipient.address).result.expectOk().expectUint(500);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2).result.expectOk().expectUint(1500);
    assertEquals(receipts.length, 3);
    receipts[2].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_NOT_ENOUGH_FUNDS);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-ft() succeeds and transfers FT to recipient",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const recipient = accounts.get("wallet_6")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    gt.getBalance(recipient.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2).result.expectOk().expectUint(0);

    // act
    // Prop 8 allow lists MIA token, mints 2000 MIA to treasury and withdraws 500 to recipient
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_008);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);

    // assert
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk().expectUint(3);
    // check the balances correspond to the proposal.
    gt.getBalance(recipient.address).result.expectOk().expectUint(500);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2).result.expectOk().expectUint(1500);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-nft() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const recipient = accounts.get("wallet_6")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const tokenId = 1;

    // act
    const { receipts } = chain.mineBlock([ccd002Treasury.withdrawNft(sender, EXTERNAL.NFT_MIA, tokenId, recipient.address)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-nft() fails if asset is not on allow list",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-mining-v2");
    ccd002Treasury.isAllowed(EXTERNAL.NFT_NYC).result.expectBool(false);
    const tokenId = 1;
    const nft = new CCEXTNft(chain, sender, "test-ccext-nft-nyc");
    // mint an asset to the treasury
    chain.mineBlock([nft.mint(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2, sender.address)]);
    // Check asset is owned by the nyc treasury
    nft.getOwner(tokenId).result.expectOk().expectSome().expectPrincipal(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2);

    // act
    // Proposal 9 attempts to withdraw nyc nft
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_009);

    // assert
    // Demonstrate ownership of asset is unchanged
    nft.getOwner(tokenId).result.expectOk().expectSome().expectPrincipal(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2);
    assertEquals(receipts.length, 4);
    receipts[3].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-nft() fails if asset is not enabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-mining-v2");
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_002);
    ccd002Treasury.isAllowed(EXTERNAL.NFT_NYC).result.expectBool(false);
    const tokenId = 1;
    const nft = new CCEXTNft(chain, sender, "test-ccext-nft-nyc");
    // mint an asset to the treasury
    chain.mineBlock([nft.mint(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2, sender.address)]);
    // Check asset is owned by the nyc treasury
    nft.getOwner(tokenId).result.expectOk().expectSome().expectPrincipal(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2);

    // act
    // Proposal 9 attempts to withdraw nyc nft
    const { receipts } = passProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_009);

    // assert
    // Demonstrate ownership of asset is unchanged
    nft.getOwner(tokenId).result.expectOk().expectSome().expectPrincipal(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2);
    assertEquals(receipts.length, 3);
    receipts[2].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNKNOWN_ASSET);
  },
});

Clarinet.test({
  name: "ccd002-treasury: withdraw-nft() succeeds and transfers NFT to recipient",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-nyc-mining-v2");
    const recipient = accounts.get("wallet_6")!;
    const nft = new CCEXTNft(chain, sender, "test-ccext-nft-nyc");
    const tokenId = 1;
    // Proposal 5 allow lists NYC NFT asset contract
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_005);
    ccd002Treasury.isAllowed(EXTERNAL.NFT_NYC).result.expectBool(true);
    // mint an asset to the treasury
    chain.mineBlock([nft.mint(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2, sender.address)]);
    nft.getOwner(tokenId).result.expectOk().expectSome().expectPrincipal(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2);
    const event = "{assetContract: " + EXTERNAL.NFT_NYC + ', caller: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccd002-treasury-v2-009, event: "withdraw-nft", recipient: ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0, sender: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.base-dao, tokenId: u1}';

    // act
    // proposal 9 transfers the nft from the treasury to recipient
    const { receipts } = passProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_009);

    // assert
    receipts[2].result.expectOk().expectUint(3);
    // check ownership of asset has changed
    nft.getOwner(tokenId).result.expectOk().expectSome().expectPrincipal(recipient.address);
    assertEquals(receipts.length, 3);
    receipts[2].events.expectNonFungibleTokenTransferEvent("u1", EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2, recipient.address, EXTERNAL.NFT_NYC, "nyc");
    receipts[2].events.expectPrintEvent(EXTENSIONS.CCD002_TREASURY_NYC_MINING_V2, event);
  },
});

Clarinet.test({
  name: "ccd002-treasury: delegate-stx() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const amount = 1000000000; // 1,000 STX
    const delegateStx = accounts.get("wallet_1")!;

    // act
    const block = chain.mineBlock([ccd002Treasury.delegateStx(sender, amount, delegateStx.address)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd002-treasury: delegate-stx() succeeds and delegates STX when called by a proposal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // act
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_011);

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result.expectOk().expectBool(true);
    receipts[1].result.expectOk().expectUint(1);
    receipts[2].result.expectOk().expectUint(2);
    receipts[3].result.expectOk().expectUint(3);
    // TODO: match print event
    // TODO: add get-stacker-info from pox?
  },
});

Clarinet.test({
  name: "ccd002-treasury: revoke-delegate-stx() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")! as Account;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");

    // act
    const block = chain.mineBlock([ccd002Treasury.revokeDelegateStx(sender)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD002Treasury.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd002-treasury: revoke-delegate-stx() succeeds and revokes delegatation when called by a proposal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // act
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_012);

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result.expectOk().expectBool(true);
    receipts[1].result.expectOk().expectUint(1);
    receipts[2].result.expectOk().expectUint(2);
    receipts[3].result.expectOk().expectUint(3);
    // TODO: match print event
    // TODO: add get-stacker-info from pox?
  },
});

// READ ONLY FUNCTIONS

Clarinet.test({
  name: "ccd002-treasury: is-allowed() succeeds and returns false if asset is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const asset = EXTERNAL.FT_MIA;

    // assert
    ccd002Treasury.isAllowed(asset).result.expectBool(false);
  },
});

Clarinet.test({
  name: "ccd002-treasury: is-allowed() succeeds and returns true if asset is found in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(false);

    // act
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_001);

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result.expectOk().expectBool(true);
    ccd002Treasury.isAllowed(EXTERNAL.FT_MIA).result.expectBool(true);
  },
});

Clarinet.test({
  name: "ccd002-treasury: get-allowed-asset() succeeds and returns none if asset is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const asset = EXTERNAL.FT_MIA;

    // assert
    ccd002Treasury.getAllowedAsset(asset).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd002-treasury: get-allowed-asset() succeeds and returns tuple if asset is found in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const asset = EXTERNAL.FT_MIA;
    ccd002Treasury.isAllowed(asset).result.expectBool(false);

    // act
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD002_TREASURY_V2_001);

    // assert
    assertEquals(receipts.length, 4);
    receipts[0].result.expectOk().expectBool(true);
    ccd002Treasury.isAllowed(asset).result.expectBool(true);
    ccd002Treasury.getAllowedAsset(asset).result.expectSome().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd002-treasury: get-balance-stx() succeeds and returns STX balance of the vault",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const amount = 1000;
    chain.mineBlock([ccd002Treasury.depositStx(sender, amount)]);

    // assert
    ccd002Treasury.getBalanceStx().result.expectUint(amount);
  },
});
