import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { CITYCOINS, EXTENSIONS } from "../../utils/common.ts";
import { CCD009AuthV2Adapter } from "../../models/extensions/ccd009-auth-v2-adapter.model.ts";

// These tests will interact with the auth-v2 contracts for MIA/NYC.

// test prep: add contract as approver in authv2
// test: can create a job
// test: can create a job and add uint argument
// test: can create a job and add principal argument
// test: can activate a job the contract created
// test: can approve and disapprove a job
// test: can execute a core contract upgrade job
// test: can execute a coinbase thresholds update job
// test: can execute a coinbase amounts update job
// test: can execute a replace approvers job

Clarinet.test({
  name: "ccd009-auth-v2-adapter: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // assert
    ccd009AuthV2Adapter.isDaoOrExtension().result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Extension callback

Clarinet.test({
  name: "ccd009-auth-v2-adapter: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: create-job-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.createJobMia(sender, "test", sender.address)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: create-job-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.createJobNyc(sender, "test", sender.address)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: activate-job-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.activateJobMia(sender, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: activate-job-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.activateJobNyc(sender, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: approve-job-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.approveJobMia(sender, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: approve-job-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.approveJobNyc(sender, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: disapprove-job-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.disapproveJobMia(sender, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: disapprove-job-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.disapproveJobNyc(sender, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: add-uint-argument-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.addUintArgumentMia(sender, 1, "test", 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: add-uint-argument-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.addUintArgumentNyc(sender, 1, "test", 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: add-principal-argument-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.addPrincipalArgumentMia(sender, 1, "test", sender.address)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: add-principal-argument-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.addPrincipalArgumentNyc(sender, 1, "test", sender.address)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: execute-upgrade-core-contract-job-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.executeUpgradeCoreContractJobMia(sender, 1, EXTENSIONS.CCD006_CITY_MINING, EXTENSIONS.CCD006_CITY_MINING)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: execute-upgrade-core-contract-job-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.executeUpgradeCoreContractJobNyc(sender, 1, EXTENSIONS.CCD006_CITY_MINING, EXTENSIONS.CCD006_CITY_MINING)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: execute-update-coinbase-thresholds-job-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.executeUpdateCoinbaseThresholdsJobMia(sender, 1, EXTENSIONS.CCD006_CITY_MINING, CITYCOINS.MIA_TOKEN)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: execute-update-coinbase-thresholds-job-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.executeUpdateCoinbaseThresholdsJobNyc(sender, 1, EXTENSIONS.CCD006_CITY_MINING, CITYCOINS.NYC_TOKEN)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: execute-update-coinbase-amounts-job-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.executeUpdateCoinbaseAmountsJobMia(sender, 1, EXTENSIONS.CCD006_CITY_MINING, CITYCOINS.MIA_TOKEN)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: execute-update-coinbase-amounts-job-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.executeUpdateCoinbaseAmountsJobNyc(sender, 1, EXTENSIONS.CCD006_CITY_MINING, CITYCOINS.NYC_TOKEN)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: execute-replace-approver-job-mia() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.executeReplaceApproverJobMia(sender, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd009-auth-v2-adapter: execute-replace-approver-job-nyc() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd009AuthV2Adapter = new CCD009AuthV2Adapter(chain, sender, "ccd009-auth-v2-adapter");

    // act
    const { receipts } = chain.mineBlock([ccd009AuthV2Adapter.executeReplaceApproverJobNyc(sender, 1)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD009AuthV2Adapter.ErrCode.ERR_UNAUTHORIZED);
  },
});
