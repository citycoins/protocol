import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { PROPOSALS } from "../../utils/common.ts";
import { BaseDao } from "../../models/base-dao.model.ts";
import { CCD001DirectExecute } from "../../models/extensions/ccd001-direct-execute.model.ts";

// PUBLIC FUNCTIONS

Clarinet.test({
  name: "ccd001-direct-execute: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);

    // assert
    ccd001DirectExecute.isDaoOrExtension().result.expectErr().expectUint(CCD001DirectExecute.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);

    // act
    const { receipts } = chain.mineBlock([ccd001DirectExecute.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: set-sunset-block-height() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);

    // act
    const { receipts } = chain.mineBlock([ccd001DirectExecute.setSunsetBlock(sender, 100)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD001DirectExecute.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: set-sunset-block-height() fails if block height is in the past",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver1 = accounts.get("wallet_1")!;
    const approver2 = accounts.get("wallet_2")!;
    const approver3 = accounts.get("wallet_3")!;

    // act
    const block = chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012), ccd001DirectExecute.directExecute(approver1, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_002), ccd001DirectExecute.directExecute(approver2, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_002), ccd001DirectExecute.directExecute(approver3, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_002)]);

    // assert
    assertEquals(block.receipts.length, 4);
    block.receipts[3].result.expectErr().expectUint(CCD001DirectExecute.ErrCode.ERR_SUNSET_IN_PAST);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: set-sunset-block-height() succeeds and returns new sunset block height",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver1 = accounts.get("wallet_1")!;
    const approver2 = accounts.get("wallet_2")!;
    const approver3 = accounts.get("wallet_3")!;

    // act
    const block = chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012), ccd001DirectExecute.directExecute(approver1, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_003), ccd001DirectExecute.directExecute(approver2, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_003), ccd001DirectExecute.directExecute(approver3, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_003)]);

    // assert
    assertEquals(block.receipts.length, 4);
    ccd001DirectExecute.isApprover(approver1.address).result.expectBool(true);
    block.receipts[3].result.expectOk().expectUint(3);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: set-approver() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const approver = accounts.get("wallet_1")!;

    // act
    const { receipts } = chain.mineBlock([ccd001DirectExecute.setApprover(sender, approver.address, true)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD001DirectExecute.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: set-signals-required() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);

    // act
    const { receipts } = chain.mineBlock([ccd001DirectExecute.setSignalsRequired(sender, 100)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD001DirectExecute.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: direct-execute() fails if sender is not an approver",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);

    // act
    const { receipts } = chain.mineBlock([ccd001DirectExecute.directExecute(sender, PROPOSALS.CCIP_012)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD001DirectExecute.ErrCode.ERR_NOT_APPROVER);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: direct-execute() fails if past sunset block height",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver1 = accounts.get("wallet_1")!;

    // act
    let block = chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012)]);
    const activationBlockHeight = block.height + 25920 + 1;
    chain.mineEmptyBlock(activationBlockHeight);
    block = chain.mineBlock([ccd001DirectExecute.directExecute(approver1, PROPOSALS.CCIP_012)]);

    // assert
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result.expectErr().expectUint(CCD001DirectExecute.ErrCode.ERR_SUNSET_REACHED);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: direct-execute() succeeds and increases signal count",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver1 = accounts.get("wallet_1")!;
    ccd001DirectExecute.getSignals(PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001).result.expectUint(0);

    // act
    const { receipts } = chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012), ccd001DirectExecute.directExecute(approver1, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001)]);

    // assert
    ccd001DirectExecute.getSignals(PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001).result.expectUint(1);
    receipts[1].result.expectOk().expectUint(1);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: direct-execute() succeeds and executes proposal if signal count reached",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    ccd001DirectExecute.getSignals(PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001).result.expectUint(0);
    const approver1 = accounts.get("wallet_1")!;
    const approver2 = accounts.get("wallet_2")!;
    const approver3 = accounts.get("wallet_3")!;

    // act
    const { receipts } = chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012), ccd001DirectExecute.directExecute(approver1, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001), ccd001DirectExecute.directExecute(approver2, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001), ccd001DirectExecute.directExecute(approver3, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001)]);

    // assert
    ccd001DirectExecute.getSignalsRequired().result.expectUint(2);
    receipts[3].result.expectOk().expectUint(3);
  },
});

// READ ONLY FUNCTIONS

Clarinet.test({
  name: "ccd001-direct-execute: is-approver() succeeds and returns false if approver is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const approver = accounts.get("wallet_1")!;

    // assert
    ccd001DirectExecute.isApprover(approver.address).result.expectBool(false);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: is-approver() succeeds and returns false if account is not an approver",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver5 = accounts.get("wallet_6")!;

    // act
    chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012)]);

    // assert
    ccd001DirectExecute.isApprover(approver5.address).result.expectBool(false);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: is-approver() succeeds and returns true if approver is in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver1 = accounts.get("wallet_1")!;

    // act
    chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012)]);

    // assert
    ccd001DirectExecute.isApprover(approver1.address).result.expectBool(true);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: has-signalled() succeeds and returns false if approver is not in map",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const approver = accounts.get("wallet_1")!;

    // assert
    ccd001DirectExecute.hasSignalled(PROPOSALS.CCIP_012, approver.address).result.expectBool(false);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: has-signalled() succeeds and returns false if approver has not signalled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver = accounts.get("wallet_1")!;

    // act
    chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012)]);

    // assert
    ccd001DirectExecute.hasSignalled(PROPOSALS.CCIP_012, approver.address).result.expectBool(false);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: has-signalled() succeeds and returns false if approver has signalled on a different proposal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver1 = accounts.get("wallet_1")!;

    // act
    chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012), ccd001DirectExecute.directExecute(approver1, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001)]);

    // assert
    ccd001DirectExecute.hasSignalled(PROPOSALS.CCIP_012, approver1.address).result.expectBool(false);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: has-signalled() succeeds and returns true if approver has signalled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver1 = accounts.get("wallet_1")!;

    // act
    chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012), ccd001DirectExecute.directExecute(approver1, PROPOSALS.CCIP_012)]);

    // assert
    ccd001DirectExecute.hasSignalled(PROPOSALS.CCIP_012, approver1.address).result.expectBool(true);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: get-signals-required() succeeds and returns required signals variable",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const expectedSignals = 1; // default value

    // assert
    ccd001DirectExecute.getSignalsRequired().result.expectUint(expectedSignals);
  },
});

Clarinet.test({
  name: "ccd001-direct-execute: get-signals() succeeds and returns correct number of signals for a proposal",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd001DirectExecute = new CCD001DirectExecute(chain, sender);
    const baseDao = new BaseDao(chain, sender);
    const approver1 = accounts.get("wallet_1")!;
    const approver2 = accounts.get("wallet_2")!;
    const approver3 = accounts.get("wallet_3")!;

    // assert
    ccd001DirectExecute.getSignals(PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001).result.expectUint(0);

    // act
    chain.mineBlock([baseDao.construct(sender, PROPOSALS.CCIP_012), ccd001DirectExecute.directExecute(approver1, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001)]);

    // assert
    ccd001DirectExecute.getSignals(PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001).result.expectUint(1);

    // act
    chain.mineBlock([ccd001DirectExecute.directExecute(approver2, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001), ccd001DirectExecute.directExecute(approver3, PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001)]);

    // assert
    ccd001DirectExecute.getSignals(PROPOSALS.TEST_CCD001_DIRECT_EXECUTE_001).result.expectUint(3);
  },
});
