import { CCD006CityMining } from "../../models/extensions/ccd006-citycoin-mining.model.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCD012RedemptionNyc } from "../../models/extensions/ccd012-redemption-nyc.model.ts";
import { CCIP022TreasuryRedemptionNYC } from "../../models/proposals/ccip022-treasury-redemption-nyc.model.ts";
import { PROPOSALS, constructAndPassProposal, nyc, passProposal } from "../../utils/common.ts";
import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd012-redemption-nyc: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);

    // act

    // assert
    ccd012RedemptionNyc.isDaoOrExtension().result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd012-redemption-nyc: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);

    // act
    const { receipts } = chain.mineBlock([ccd012RedemptionNyc.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

// =============================
// initialize-redemption()
// =============================

Clarinet.test({
  name: "ccd012-redemption-nyc: initialize-redemption() fails with ERR_UNAUTHORIZED when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd012RedemptionNyc = new CCD012RedemptionNyc(chain, sender);

    // act
    const initializeBlock = chain.mineBlock([ccd012RedemptionNyc.initializeRedemption(sender)]);

    // assert
    assertEquals(initializeBlock.receipts.length, 1);
    initializeBlock.receipts[0].result.expectErr().expectUint(CCD012RedemptionNyc.ErrCode.ERR_UNAUTHORIZED);
  },
});

// initialize-redemption() fails with ERR_GETTING_TOTAL_SUPPLY if both supplies are 0
// initialize-redemption() fails with ERR_GETTING_REDEMPTION_BALANCE if the redemption balance is 0
// initialize-redemption() fails with ERR_ALREADY_ENABLED if called more than once
// initialize-redemption() succeeds and prints the redemption info

// =============================
// redeem-nyc()
// =============================

// redeem-nyc() fails with ERR_NOTHING_TO_REDEEM if the redemption amount is none
// redeem-nyc() fails with ERR_NOT_ENABLED if the redemption is not initialized
// redeem-nyc() fails with ERR_ALREADY_CLAIMED if the redemption is already claimed
// redeem-nyc() fails with ERR_BALANCE_NOT_FOUND if v1 or v2 tokens are not found
// redeem-nyc() fails with ERR_NOTHING_TO_REDEEM if the redemption amount is 0
// redeem-nyc() succeeds with just v1 tokens
// redeem-nyc() succeeds with just v2 tokens
// redeem-nyc() succeeds with both v1 and v2 tokens
