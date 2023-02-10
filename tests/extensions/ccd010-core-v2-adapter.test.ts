import { Account, assertEquals, Clarinet, Chain, types } from "../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD010CoreV2Adapter } from "../../models/extensions/ccd010-core-v2-adapter.model.ts";

// =============================
// disabled functions (legacy protocol)
// =============================

Clarinet.test({
  name: "ccd010-core-v2-adapter: register-user() is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.registerUser(sender, "mia", 1)]);

    // assert
    receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_FUNCTION_DISABLED);
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: mine-tokens() is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.mineTokens(sender, 1, "mia")]);

    // assert
    receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_FUNCTION_DISABLED);
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: mine-many() is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.mineMany(sender, [1, 1, 1])]);

    // assert
    receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_FUNCTION_DISABLED);
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: claim-mining-reward() is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.claimMiningReward(sender, 1)]);

    // assert
    receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_FUNCTION_DISABLED);
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: stack-tokens() is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.stackTokens(sender, 1, 1)]);

    // assert
    receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_FUNCTION_DISABLED);
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: claim-stacking-reward() is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.claimStackingReward(sender, 1)]);

    // assert
    receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_FUNCTION_DISABLED);
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: set-city-wallet() succeeds and returns (ok true)",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.setCityWallet(sender, sender.address)]);

    // assert
    receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: update-coinbase-thresholds() succeeds and returns (ok true)",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.updateCoinbaseThresholds(sender, 1, 1)]);

    // assert
    receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: update-coinbase-amounts() succeeds and returns (ok true)",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.updateCoinbaseAmounts(sender, 1, 1)]);

    // assert
    receipts[0].result.expectOk();
  },
});

Clarinet.test({
  name: "ccd010-core-v2-adapter: shutdown-contract() is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd010CoreV2Adapter = new CCD010CoreV2Adapter(chain, sender, "ccd010-core-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd010CoreV2Adapter.shutdownContract(sender, 100)]);

    // assert
    receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_FUNCTION_DISABLED);
  },
});
