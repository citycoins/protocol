import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { BASE_DAO, EXTENSIONS, PROPOSALS } from "../../utils/common.ts";
import { BaseDao } from "../../models/base-dao.model.ts";
import { CCD001DirectExecute } from "../../models/extensions/ccd001-direct-execute.model.ts";

const baseDao = new BaseDao();
const ccd001DirectExecute = new CCD001DirectExecute();

// Authorization check

Clarinet.test({
  name: "ccd001-direct-execute: is-dao-or-extenion() fails when called directly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.isDaoOrExtension(sender),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD001DirectExecute.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Internal DAO functions

Clarinet.test({
  name: "ccd001-direct-execute: set-sunset-block-height() fails when called directly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.setSunsetBlockHeight(sender, 100),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD001DirectExecute.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: set-approver() fails when called directly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const approver = accounts.get("wallet_1")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.setApprover(sender, approver.address, true),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD001DirectExecute.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: set-signals-required() fails when called directly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.setSignalsRequired(sender, 100),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD001DirectExecute.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Public Functions

Clarinet.test({
  name: "ccd001-direct-execute: is-approver() returns false if approver is not in map",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const approver = accounts.get("wallet_1")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.isApprover(sender, approver.address),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectBool(false);
  },
});

// ccd001-direct-execute: is-approver() returns true if approver is in map

// ccd001-direct-execute: has-signalled() returns false if approver is not in map
Clarinet.test({
  name: "ccd001-direct-execute: has-signalled() returns false if approver is not in map",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const approver = accounts.get("wallet_1")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.hasSignalled(
        sender,
        PROPOSALS.CCIP_012,
        approver.address
      ),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectBool(false);
  },
});

// ccd001-direct-execute: has-signalled() returns false if approver has not signalled
// ccd001-direct-execute: has-signalled() returns true if approver has signalled

Clarinet.test({
  name: "ccd001-direct-execute: get-signals-required() returns required signals variable",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const expectedSignals = 1; // default value

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.getSignalsRequired(sender),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectUint(expectedSignals);
  },
});

// ccd001-direct-execute: get-signals() returns number of signals for a proposal

Clarinet.test({
  name: "ccd001-direct-execute: direct-execute() fails if sender is not an approver",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.directExecute(sender, PROPOSALS.CCIP_012),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result
      .expectErr()
      .expectUint(CCD001DirectExecute.ErrCode.ERR_NOT_APPROVER);
  },
});

// ccd001-direct-execute: direct-execute() fails if past sunset block height
// ccd001-direct-execute: direct-execute() succeeds and increases signal count
// ccd001-direct-execute: direct-execute() succeeds and executes proposal if signal count reached

// Extension callback

Clarinet.test({
  name: "ccd001-direct-execute: callback() succeeds when called directly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    // act
    const { receipts } = chain.mineBlock([
      ccd001DirectExecute.extensionCallback(sender, "test"),
    ]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});
