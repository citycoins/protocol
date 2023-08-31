/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. mine
 * 2. claim-mining-reward
 * 3. reward-delay
 * 4. mining status
 * 5. read-only functions
 */
import { Account, assert, assertEquals, Clarinet, Chain, types } from "../../utils/deps.ts";
import { constructAndPassProposal, EXTENSIONS, passCcip014, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD002Treasury } from "../../models/extensions/ccd002-treasury.model.ts";
import { CCD003UserRegistry } from "../../models/extensions/ccd003-user-registry.model.ts";
import { CCD005CityData } from "../../models/extensions/ccd005-city-data.model.ts";
import { CCD006CityMining } from "../../models/extensions/ccd006-citycoin-mining.model.ts";
import { CCD010CoreV2Adapter } from "../../models/extensions/ccd010-core-v2-adapter.model.ts";
import { CCEXTGovernanceToken } from "../../models/external/test-ccext-governance-token.model.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const rewardDelay = 100;
const miaCityId = 1;
const miaCityName = "mia";
const miaTreasuryId = 1;
const miaMiningTreasuryName = "mining";
const miaTreasuryName = "ccd002-treasury-mia-mining";
const miaTreasuryNameV2 = "ccd002-treasury-mia-mining-v2";

/**
 * Useful for debugging and understanding tests
const dumpMiningData = (ccd006CityMining: any, cityId: number, height: number, userId: number, miningStatsAt: object, minerAt: object) => {
  console.log("getMiningStats: [height: " + height + "] --> " + ccd006CityMiningV2.getMiningStats(cityId, height).result);
  console.log("getMiningStats: [height: " + height + "] --> ", miningStatsAt);
  console.log("getMiner: [height: " + height + ", userId: " + userId + "] --> " + ccd006CityMiningV2.getMiner(cityId, height, userId).result);
  console.log("getMiner: [height: " + height + ", userId: " + userId + "] --> ", minerAt);
};
 */

const checkMiningData = (ccd006CityMiningV2: any, cityId: number, height: number, userId: number, miningStatsAt: any, minerAt: any) => {
  let expectedStats: any = {
    amount: types.uint(miningStatsAt.amount),
    claimed: types.bool(miningStatsAt.claimed),
    miners: types.uint(miningStatsAt.miners),
  };
  assertEquals(ccd006CityMiningV2.getMiningStats(cityId, height).result.expectTuple(), expectedStats);

  expectedStats = {
    commit: types.uint(minerAt.commit),
    high: types.uint(minerAt.high),
    low: types.uint(minerAt.low),
    winner: types.bool(minerAt.winner),
  };
  assertEquals(ccd006CityMiningV2.getMiner(cityId, height, userId).result.expectTuple(), expectedStats);
};

const twoMinersMine = (user1: Account, user2: Account, ccd006CityMiningV2: CCD006CityMining, chain: Chain, sender: Account): any => {
  const entries: number[] = [10];
  const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, miaCityName, entries), ccd006CityMiningV2.mine(user2, miaCityName, entries)]);
  const claimHeight = miningBlock.height - 1;
  chain.mineEmptyBlock(rewardDelay + 1);
  const miningClaimBlock = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user1, miaCityName, claimHeight), ccd006CityMiningV2.claimMiningReward(user2, miaCityName, claimHeight)]);

  miningBlock.receipts[0].events.expectSTXTransferEvent(10, user1.address, `${sender.address}.${miaTreasuryNameV2}`);
  miningBlock.receipts[1].events.expectSTXTransferEvent(10, user2.address, `${sender.address}.${miaTreasuryNameV2}`);
  let winner = 0;
  let coinbase = 0;
  if (miningClaimBlock.receipts[0].result === "(ok true)") {
    //console.log("======== USER 1 WINS =========================")
    ccd006CityMiningV2.getBlockWinner(miaCityId, claimHeight).result.expectSome().expectUint(1);
    coinbase = Number(ccd006CityMiningV2.getCoinbaseAmount(miaCityId, claimHeight).result.substring(1));
    miningClaimBlock.receipts[0].result.expectOk().expectBool(true);
    /**
    console.log("getCoinbaseAmount : " + coinbase)
    console.log("isBlockWinner : " + ccd006CityMiningV2.isBlockWinner(miaCityId, user1.address, claimHeight).result.expectSome().expectTuple())
    console.log("getMiningStats : ", ccd006CityMiningV2.getMiningStats(miaCityId, claimHeight))
    */
    winner = 1;
  } else if (miningClaimBlock.receipts[1].result === "(ok true)") {
    //console.log("======== USER 2 WINS =========================")
    ccd006CityMiningV2.getBlockWinner(miaCityId, claimHeight).result.expectSome().expectUint(2);
    //miningClaimBlock.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINER_NOT_WINNER);
    miningClaimBlock.receipts[1].result.expectOk().expectBool(true);
    coinbase = Number(ccd006CityMiningV2.getCoinbaseAmount(miaCityId, claimHeight).result.substring(1));
    winner = 2;
    /**
    console.log("getCoinbaseAmount : " + coinbase)
    console.log("isBlockWinner : " + ccd006CityMiningV2.isBlockWinner(miaCityId, user2.address, claimHeight).result.expectSome().expectTuple())
    console.log("getMiningStats : ", ccd006CityMiningV2.getMiningStats(miaCityId, claimHeight))
     */
  } else {
    console.log("======== NOONE WINS =========================");
    return 3;
  }
  return { miningBlock, miningClaimBlock, claimHeight, winner, coinbase };
};

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act

    // assert
    ccd006CityMiningV2.isDaoOrExtension().result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_UNAUTHORIZED);
  },
});

// Extension callback

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const { receipts } = chain.mineBlock([ccd006CityMiningV2.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

// =============================
// 1. mine
// =============================

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries = [10, 10];
    const { receipts } = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_CITY);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if city is not active",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries = [10, 10];
    const upgrade = passCcip014(chain, accounts);
    // console.log("upgrade: ", upgrade);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_003);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);
    //console.log("block: ", block);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INACTIVE_CITY);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if mining contract is not a valid dao extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries = [10, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_V2_006);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD003UserRegistry.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if user has insufficient balance",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries = [100000000000001];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_NOT_ENOUGH_FUNDS);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() succeeds if user's cumulative commit uses their exact balance",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const ccd002TreasuryV2 = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    // balance is 100000000000000 by default + 50000000 from transition to v2
    const expectedBalance = 100000050000000;
    const entries = [50000000000000, 50000000000000];

    // act
    ccd002TreasuryV2.getBalanceStx().result.expectUint(0);
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(wallet_2, miaCityName, entries)]);

    // assert
    ccd002TreasuryV2.getBalanceStx().result.expectUint(expectedBalance);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if user's cumulative commit leaves insufficient balance",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries = [50000000000000, 50000000000000, 1];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);

    // assert
    ccd002Treasury.getBalanceStx().result.expectUint(0);
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_NOT_ENOUGH_FUNDS);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if city is inactive",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries = [10, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_003);

    const block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INACTIVE_CITY);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if called with no commit amounts",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries: number[] = [];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_COMMITS);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if a commit amount in the list is zero",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries: number[] = [10, 10, 10, 0, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_COMMITS);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() succeeds and mines 1 block for 1 user",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries: number[] = [10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(user, miaCityName, entries)]);

    // assert
    const firstBlock = block.height - 1;
    const lastBlock = firstBlock;
    const totalAmount = 10;
    const totalBlocks = 1;
    const userId = 2;

    block.receipts[0].result.expectOk().expectBool(true);

    block.receipts[0].events.expectSTXTransferEvent(totalAmount, user.address, `${sender.address}.${miaTreasuryNameV2}`);
    const expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userId)}}`;
    //console.log(block.receipts[0].events[1].contract_event.value)
    //ccd006CityMiningV2.isBlockWinner(miaCityId, user.address, firstBlock).result.expectBool(true)
    const expectedStats2 = {
      commit: types.uint(totalAmount),
      high: types.uint(totalAmount),
      low: types.uint(0),
      winner: types.bool(false),
    };
    assertEquals(ccd006CityMiningV2.getMiner(miaCityId, firstBlock, userId).result.expectTuple(), expectedStats2);
    const expectedStats = {
      amount: types.uint(totalAmount),
      claimed: types.bool(false),
      miners: types.uint(1),
    };
    assertEquals(ccd006CityMiningV2.getMiningStats(miaCityId, firstBlock).result.expectTuple(), expectedStats);
    ccd006CityMiningV2.getBlockWinner(miaCityId, firstBlock).result.expectNone();

    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() succeeds and mines 200 blocks for 1 user",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const userId = 2;
    const commitAmount = 10;
    const numberOfBlocks = 200;
    const entries = new Array<number>(numberOfBlocks).fill(commitAmount);
    const totalAmount = entries.reduce((a, b) => a + b, 0);
    const totalBlocks = entries.length;

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(user, miaCityName, entries)]);

    const firstBlock = block.height - 1;
    const lastBlock = firstBlock + entries.length - 1;

    // assert

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[0].events.expectSTXTransferEvent(totalAmount, user.address, `${sender.address}.${miaTreasuryNameV2}`);

    // mining stats at block
    const expectedStats = {
      amount: types.uint(commitAmount),
      claimed: types.bool(false),
      miners: types.uint(1),
    };
    // miner stats at each block
    const expectedMinerStats = {
      commit: types.uint(commitAmount),
      high: types.uint(commitAmount),
      low: types.uint(0),
      winner: types.bool(false),
    };
    for (let i = 0; i < entries.length; i++) {
      assertEquals(ccd006CityMiningV2.getMiningStats(miaCityId, firstBlock).result.expectTuple(), expectedStats);
      assertEquals(ccd006CityMiningV2.getMiner(miaCityId, firstBlock + i, userId).result.expectTuple(), expectedMinerStats);
    }

    ccd006CityMiningV2.getBlockWinner(miaCityId, firstBlock).result.expectNone();
    const expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userId)}}`;
    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() successfully mines 100 blocks for 3 users",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const users = [accounts.get("wallet_1")!, accounts.get("wallet_2")!, accounts.get("wallet_3")!];
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const userIds = [2, 3, 4];
    const commitAmount = 100;
    const numberOfBlocks = 100;
    const entries = new Array<number>(numberOfBlocks).fill(commitAmount);
    const totalCommit = entries.reduce((a, b) => a + b, 0);
    const totalBlocks = entries.length;

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(users[0], miaCityName, entries), ccd006CityMiningV2.mine(users[1], miaCityName, entries), ccd006CityMiningV2.mine(users[2], miaCityName, entries)]);
    const firstBlock = block.height - 1;
    const lastBlock = firstBlock + entries.length - 1;

    // assert

    for (let i = 0; i < userIds.length; i++) {
      // check that each event succeeded
      block.receipts[i].result.expectOk().expectBool(true);
      // check that each event transferred the correct amount to the correct address
      block.receipts[i].events.expectSTXTransferEvent(totalCommit, users[i].address, `${sender.address}.${miaTreasuryNameV2}`);
    }

    // mining stats at block
    const expectedStats = {
      amount: types.uint(commitAmount * users.length),
      claimed: types.bool(false),
      miners: types.uint(users.length),
    };
    // loop through each block to check miner stats
    for (let i = 0; i < entries.length; i++) {
      assertEquals(ccd006CityMiningV2.getMiningStats(miaCityId, firstBlock).result.expectTuple(), expectedStats);
      // loop through each user
      for (let j = 0; j < userIds.length; j++) {
        // check the data
        const lastCommit = commitAmount * j;
        const currentCommit = commitAmount * (j + 1);
        const expectedMinerStats = {
          commit: types.uint(commitAmount),
          high: types.uint(currentCommit),
          low: types.uint(j === 0 ? 0 : lastCommit + 1),
          winner: types.bool(false),
        };
        assertEquals(ccd006CityMiningV2.getMiner(miaCityId, firstBlock + i, userIds[j]).result.expectTuple(), expectedMinerStats);
      }
    }

    // check the print message for each user
    for (let i = 0; i < userIds.length; i++) {
      const expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalCommit)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userIds[i])}}`;
      block.receipts[i].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
      block.receipts[i].result.expectOk().expectBool(true);
    }
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if user has already mined",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002TreasuryV2 = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const totalAmount = 30;
    const totalBlocks = 3;
    const userId = 1;
    const entries: number[] = [10, 10, 10];

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries), ccd006CityMiningV2.mine(sender, miaCityName, entries)]);
    const firstBlock = block.height - 1;
    const lastBlock = firstBlock + entries.length - 1;

    // assert

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_ALREADY_MINED);
    block.receipts[0].events.expectSTXTransferEvent(totalAmount, sender.address, `${sender.address}.${miaTreasuryNameV2}`);
    //console.log("miningBlock:", block.receipts[0].events[0].contract_event.value);

    // block.receipts[1].events.expectSTXTransferEvent(totalAmount, sender.address, `${sender.address}.${miaTreasuryNameV2}`);

    const expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userId)}}`;

    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);

    // Expecting ERR_ALREADY_MINED if same user tried mine twice at same height ?
    block.receipts[1].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_ALREADY_MINED);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() keeps track of mining stats for 4 users mining 3 blocks concurrently",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const users = [accounts.get("wallet_1")!, accounts.get("wallet_2")!, accounts.get("wallet_3")!, accounts.get("wallet_4")!];

    const ccd002TreasuryV2 = new CCD002Treasury(chain, sender, "ccd002-treasury-mia-mining-v2");
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const ccd003UserRegistry = new CCD003UserRegistry(chain, sender, "ccd003-user-registry");

    const totalAmount = 120;
    const totalBlocks = 3;
    const entries: number[] = [10, 10, 10];

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    const block = chain.mineBlock([ccd006CityMiningV2.mine(users[0], miaCityName, entries), ccd006CityMiningV2.mine(users[1], miaCityName, entries), ccd006CityMiningV2.mine(users[2], miaCityName, entries), ccd006CityMiningV2.mine(users[3], miaCityName, entries)]);
    const firstBlock = block.height - 1;
    const lastBlock = firstBlock + entries.length - 1;

    // assert
    let miningStatsAt, minerAt;
    for (let idx = 0; idx < 4; idx++) {
      block.receipts[idx].result.expectOk().expectBool(true);
      ccd003UserRegistry
        .getUserId(users[idx].address)
        .result.expectSome()
        .expectUint(idx + 2);
      ccd003UserRegistry
        .getUser(idx + 2)
        .result.expectSome()
        .expectPrincipal(users[idx].address);
      block.receipts[idx].events.expectSTXTransferEvent(30, users[idx].address, `${sender.address}.${miaTreasuryNameV2}`);

      const expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount / 4)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(idx + 2)}}`;
      //console.log(idx, block.receipts[idx].events);
      block.receipts[idx].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
    }

    for (let blockIdx = 0; blockIdx < entries.length; blockIdx++) {
      // for 3 blocks
      for (let userIdx = 0; userIdx < users.length; userIdx++) {
        // for 4 users
        miningStatsAt = {
          amount: types.uint(users.length * entries[blockIdx]),
          claimed: types.bool(false),
          miners: types.uint(users.length),
        };
        minerAt = {
          commit: types.uint(10),
          high: types.uint(10 * (userIdx + 1)),
          low: types.uint(userIdx === 0 ? 0 : userIdx * 10 + 1),
          winner: types.bool(false),
        };
        assertEquals(ccd006CityMiningV2.getMiningStats(miaCityId, firstBlock + blockIdx).result.expectTuple(), miningStatsAt);
        assertEquals(ccd006CityMiningV2.getMiner(miaCityId, firstBlock + blockIdx, userIdx + 2).result.expectTuple(), minerAt);
      }
    }
    // check high values
    ccd006CityMiningV2.getHighValue(miaCityId, firstBlock).result.expectUint(totalAmount / 3);
    ccd006CityMiningV2.getHighValue(miaCityId, lastBlock).result.expectUint(totalAmount / 3);
    ccd006CityMiningV2.getHighValue(miaCityId, lastBlock + 1).result.expectUint(0);
  },
});

// =============================
// 2. claim-mining-reward
// =============================

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: is-block-winner() correctly identifies winning miner who has not claimed",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const totalAmount = 10;
    const totalBlocks = 1;
    const entries: number[] = [10];
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING_V2).result.expectOk().expectUint(0);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);

    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, miaCityName, entries)]);
    // console.log(`miningBlock:\n${JSON.stringify(miningBlock, null, 2)}}`);
    const claimHeight = miningBlock.height - 1;
    const lastBlock = claimHeight + totalBlocks - 1;
    chain.mineEmptyBlock(rewardDelay + 1);

    // assert
    miningBlock.receipts[0].result.expectOk().expectBool(true);

    // Check stx transfer events
    miningBlock.receipts[0].events.expectSTXTransferEvent(10, user1.address, `${sender.address}.${miaTreasuryNameV2}`);

    // Check mining events
    const expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(claimHeight)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(2)}}`;
    miningBlock.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);

    const expected = {
      claimed: types.bool(false),
      winner: types.bool(true),
    };
    const isBlockWinner = ccd006CityMiningV2.isBlockWinner(miaCityId, user1.address, claimHeight);
    //console.log(JSON.stringify(isBlockWinner, null, 2));
    // console.log(`isBlockWinner:\n${JSON.stringify(isBlockWinner, null, 2)}}`);
    assertEquals(isBlockWinner.result.expectSome().expectTuple(), expected);
    // is-block-winner calculates the winning status of given user.
    // get-block-winner reads it from the map which is written by claim-mining-reward.
    // so user1 is not returned by the following. This is correct, since the map isn't written
    // to until the reward is claimed,
    // we would expect the value to be none here while the output of isBlockWinner() above
    // will be (some (claimed false) (winner true)).
    ccd006CityMiningV2.getBlockWinner(miaCityId, claimHeight).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: is-block-winner() correctly identifies winning miner who has claimed",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const totalAmount = 10;
    const totalBlocks = 1;
    const entries: number[] = [10];
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING).result.expectOk().expectUint(0);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city coinbase amounts
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    // set city coinbase thresholds
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    // set city coinbase details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    passCcip014(chain, accounts);

    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, miaCityName, entries)]);
    const miningHeight = miningBlock.height - 1;
    chain.mineEmptyBlock(rewardDelay + 1);
    const miningClaimBlock = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user1, miaCityName, miningHeight)]);

    // assert
    miningBlock.receipts[0].result.expectOk().expectBool(true);
    // Check mining event
    let expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(miningHeight)}, lastBlock: ${types.uint(miningHeight)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(2)}}`;
    miningBlock.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
    // Check mining claim event
    expectedPrintMsg = `{cityId: u1, cityName: "mia", claimHeight: ${types.uint(miningHeight)}, event: "mining-claim", userId: ${types.uint(2)}}`;
    miningClaimBlock.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
    // Check stx transfer events
    miningBlock.receipts[0].events.expectSTXTransferEvent(10, user1.address, `${sender.address}.${miaTreasuryNameV2}`);
    const expected = {
      claimed: types.bool(true),
      winner: types.bool(true),
    };
    assertEquals(ccd006CityMiningV2.isBlockWinner(miaCityId, user1.address, miningHeight).result.expectSome().expectTuple(), expected);
    ccd006CityMiningV2.getBlockWinner(miaCityId, miningHeight).result.expectSome().expectUint(2);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() is not possible for an unknown city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const { receipts } = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(sender, miaCityName, 50)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(100);
    receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_CITY);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() is not possible if current tip height is less than maturity height ",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(sender, miaCityName, 50)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(100);
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_REWARD_IMMATURE);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() is not possible if current tip height is equal to maturity height",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    const claimBlock = passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    chain.mineEmptyBlock(rewardDelay - 1);
    const block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(sender, miaCityName, claimBlock.height)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_REWARD_IMMATURE);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() is not possible if user is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const claimHeight = 5; // one less than actual bh
    chain.mineEmptyBlock(rewardDelay);
    const block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(sender, miaCityName, claimHeight)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_USER);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() returns ERR_NO_MINER_DATA if user did not mine in that block",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    const claimHeight = 6; // one less than actual bh
    chain.mineEmptyBlock(rewardDelay);
    const block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user, miaCityName, claimHeight)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_NO_MINER_DATA);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() fails if a user tries claiming another users rewards",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries: number[] = [10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);

    let block = chain.mineBlock([ccd006CityMiningV2.mine(sender, miaCityName, entries)]);
    const claimHeight = block.height - 1; // one less than actual bh
    chain.mineEmptyBlock(rewardDelay);
    block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user, miaCityName, claimHeight)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_USER);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() fails if there is nothing to mint at the given claim height",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries: number[] = [10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    let block = chain.mineBlock([ccd006CityMiningV2.mine(user, miaCityName, entries)]);
    const claimHeight = block.height - 1; // one less than actual bh
    chain.mineEmptyBlock(rewardDelay);
    block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user, miaCityName, claimHeight)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);
    block.receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_NOTHING_TO_MINT);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() fails with ERR_NOTHING_TO_MINT if the coinbase amounts have not been set for the given city",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries: number[] = [10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);

    let block = chain.mineBlock([ccd006CityMiningV2.mine(user, miaCityName, entries)]);
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[0].result.expectOk().expectBool(true);
    const firstBlock = block.height - 1;
    const lastBlock = firstBlock;
    const totalAmount = 10;
    const totalBlocks = 1;
    const userId = 2;
    block.receipts[0].events.expectSTXTransferEvent(10, user.address, `${sender.address}.${miaTreasuryNameV2}`);
    const expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userId)}}`;
    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);

    //const miningStatsAt = { amount: 10, claimed: false, miners: 1 };
    //const minerAt = { commit: 10, high: 11, low: 0, winner: false };
    // dumpMiningData(ccd006CityMiningV2, miaCityId, (firstBlock), (1), miningStatsAt, minerAt);

    const claimHeight = block.height - 1;
    chain.mineEmptyBlock(rewardDelay + 1);
    block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user, miaCityName, claimHeight)]);

    // assert

    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);
    block.receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_NOTHING_TO_MINT);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() fails with ERR_NOTHING_TO_MINT if called at the wrong claim height",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries: number[] = [10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);

    let block = chain.mineBlock([ccd006CityMiningV2.mine(user, miaCityName, entries)]);
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[0].result.expectOk().expectBool(true);
    const firstBlock = block.height - 1;
    const lastBlock = firstBlock;
    const totalAmount = 10;
    const totalBlocks = 1;
    const userId = 2;
    block.receipts[0].events.expectSTXTransferEvent(10, user.address, `${sender.address}.${miaTreasuryNameV2}`);
    const expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userId)}}`;
    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);

    //const miningStatsAt = { amount: 10, claimed: false, miners: 1 };
    //const minerAt = { commit: 10, high: 11, low: 0, winner: false };
    //dumpMiningData(ccd006CityMiningV2, miaCityId, (firstBlock), (1), miningStatsAt, minerAt);

    const claimHeight = block.height - 1;
    chain.mineEmptyBlock(rewardDelay + 1);

    block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user, miaCityName, claimHeight)]);

    // assert

    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);
    block.receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_NOTHING_TO_MINT);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() fails if user is not the winner or if there is nothing to mint",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const totalAmount = 10;
    const totalBlocks = 1;
    const entries: number[] = [10];

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);

    const block1 = chain.mineBlock([ccd006CityMiningV2.mine(user1, miaCityName, entries), ccd006CityMiningV2.mine(user2, miaCityName, entries)]);
    const firstBlock = block1.height - 1;
    const lastBlock = firstBlock + entries.length - 1;

    chain.mineEmptyBlock(rewardDelay);
    const block2 = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user1, miaCityName, firstBlock), ccd006CityMiningV2.claimMiningReward(user2, miaCityName, firstBlock)]);

    // assert

    block1.receipts[0].result.expectOk().expectBool(true);
    block1.receipts[1].result.expectOk().expectBool(true);

    if (block2.receipts[0].result === "(err u6015)") {
      //console.log("USER 2 WINS");
      block2.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINER_NOT_WINNER);
      block2.receipts[1].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_NOTHING_TO_MINT);
    } else {
      //console.log("USER 1 WINS");
      block2.receipts[0].result.expectErr().expectUint(CCD010CoreV2Adapter.ErrCode.ERR_NOTHING_TO_MINT);
      block2.receipts[1].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINER_NOT_WINNER);
    }

    block1.receipts[0].events.expectSTXTransferEvent(10, user1.address, `${sender.address}.${miaTreasuryNameV2}`);
    block1.receipts[1].events.expectSTXTransferEvent(10, user2.address, `${sender.address}.${miaTreasuryNameV2}`);

    let expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(2)}}`;
    block1.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
    expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(3)}}`;
    block1.receipts[1].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);

    //dumpMiningData(ccd006CityMiningV2, miaCityId, (firstBlock), (1), miningStatsAt, minerAt);
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);

    //ccd006CityMiningV2.getBlockWinner(miaCityId, firstBlock).result.expectUint(2);
    ccd006CityMiningV2.getBlockWinner(miaCityId, firstBlock).result.expectNone();
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() user makes successful claim",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const totalAmount = 10;
    const totalBlocks = 1;
    const entries = [10];

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    passCcip014(chain, accounts);

    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, miaCityName, entries), ccd006CityMiningV2.mine(user2, miaCityName, entries)]);
    // console.log(JSON.stringify(miningBlock, null, 2));
    const claimHeight = miningBlock.height - 1;
    const lastBlock = claimHeight + totalBlocks - 1;
    chain.mineEmptyBlock(rewardDelay + 1);

    const miningClaimUser1 = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user1, miaCityName, claimHeight)]);
    const miningClaimUser2 = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user2, miaCityName, claimHeight)]);

    // assert
    miningBlock.receipts[0].result.expectOk().expectBool(true);
    miningBlock.receipts[0].events.expectSTXTransferEvent(totalAmount, user1.address, `${sender.address}.${miaTreasuryNameV2}`);
    miningBlock.receipts[1].result.expectOk().expectBool(true);
    miningBlock.receipts[1].events.expectSTXTransferEvent(totalAmount, user2.address, `${sender.address}.${miaTreasuryNameV2}`);

    //const miningStatsAt = { amount: 10, claimed: false, miners: 1 };
    //const minerAt = { commit: 10, high: 11, low: 0, winner: false };
    //dumpMiningData(ccd006CityMiningV2, miaCityId, (firstBlock), (1), miningStatsAt, minerAt);
    //dumpMiningData(ccd006CityMiningV2, miaCityId, (firstBlock), (2), miningStatsAt, minerAt);

    //console.log(`miningClaimUser1:\n${JSON.stringify(miningClaimUser1, null, 2)}\n`);
    //console.log(`miningClaimUser2:\n${JSON.stringify(miningClaimUser2, null, 2)}\n`);

    let winner: number;

    if (miningClaimUser2.receipts[0].result === "(err u6015)") {
      //console.log("USER 1 WINS");
      miningClaimUser1.receipts[0].result.expectOk().expectBool(true);
      miningClaimUser2.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_ALREADY_CLAIMED);
      winner = 2;
    } else {
      //console.log("USER 2 WINS");
      miningClaimUser1.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINER_NOT_WINNER);
      miningClaimUser2.receipts[0].result.expectOk().expectBool(true);
      winner = 3;
    }

    // {cityId: u1, cityName: \"mia\", cityTreasury: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-mia-mining, event: \"mining\", firstBlock: u10, lastBlock: u10, totalAmount: u10, totalBlocks: u1, userId: u1}"}
    let expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(claimHeight)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(2)}}`;
    // console.log(JSON.stringify(miningBlock.receipts[0].events), null, 2);
    miningBlock.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
    expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(claimHeight)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(3)}}`;
    miningBlock.receipts[1].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);

    //dumpMiningData(ccd006CityMiningV2, miaCityId, (firstBlock), (1), miningStatsAt, minerAt);
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);

    //ccd006CityMiningV2.getBlockWinner(miaCityId, firstBlock).result.expectUint(2);
    ccd006CityMiningV2.getBlockWinner(miaCityId, claimHeight).result.expectSome().expectUint(winner);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() fails if user claims at incorrect height",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    passCcip014(chain, accounts);

    // assert
    const entries = [10];
    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, miaCityName, entries)]);
    const claimHeight = miningBlock.height - 1;
    chain.mineEmptyBlock(rewardDelay + 1);
    const miningClaimBlock = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user1, miaCityName, claimHeight + 1), ccd006CityMiningV2.claimMiningReward(user1, miaCityName, claimHeight - 1), ccd006CityMiningV2.claimMiningReward(user1, miaCityName, claimHeight)]);

    //console.log(`miningClaimBlock: ${JSON.stringify(miningClaimBlock, null, 2)}}`);

    // assert
    miningClaimBlock.receipts[2].result.expectOk().expectBool(true);
    miningClaimBlock.receipts[1].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_NO_MINER_DATA);
    miningClaimBlock.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_NO_MINER_DATA);
  },
});

// =============================
// 3. REWARD DELAY
// =============================

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: set-reward-delay() can only be called by the dao",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const { receipts } = chain.mineBlock([ccd006CityMiningV2.setRewardDelay(sender, 50)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(100);
    receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: set-reward-delay() cannot set a zero block delay",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_004);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(100);
    receipts[3].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_DELAY);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: set-reward-delay() successfully changes the reward delay when called by the dao",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    ccd006CityMiningV2.getRewardDelay().result.expectUint(100);

    // act
    const { receipts } = constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_V2_007);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(50);
    assertEquals(receipts.length, 4);
    receipts[3].result.expectOk();
  },
});

// =============================
// 4. MINING STATUS
// =============================

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: mine() fails if mining is disabled in the contract",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const entries: number[] = [10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passCcip014(chain, accounts);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_V2_005);

    const block = chain.mineBlock([ccd006CityMiningV2.mine(user, miaCityName, entries)]);

    // assert
    const firstBlock = block.height - 1;
    const userId = 1;

    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINING_DISABLED);

    const expectedMiningStats = {
      amount: types.uint(0),
      claimed: types.bool(false),
      miners: types.uint(0),
    };
    assertEquals(ccd006CityMiningV2.getMiningStats(miaCityId, firstBlock).result.expectTuple(), expectedMiningStats);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() returns ERR_NO_MINER_DATA after mining is disabled if user did not mine in that block",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user = accounts.get("wallet_1")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD003_USER_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_005);
    const claimHeight = 6; // one less than actual bh
    chain.mineEmptyBlock(rewardDelay);
    const block = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user, miaCityName, claimHeight)]);

    // assert
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_NO_MINER_DATA);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: claim-mining-reward() succeeds after mining is disabled",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    const entries = [10];
    const totalAmount = entries.reduce((a, b) => a + b, 0);
    const totalBlocks = entries.length;

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    passCcip014(chain, accounts);

    const miningBlock = chain.mineBlock([ccd006CityMiningV2.mine(user1, miaCityName, entries), ccd006CityMiningV2.mine(user2, miaCityName, entries)]);
    // console.log(JSON.stringify(miningBlock, null, 2));
    const claimHeight = miningBlock.height - 1;
    const lastBlock = claimHeight + totalBlocks - 1;
    chain.mineEmptyBlock(rewardDelay + 1);

    // disable mining
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_V2_005);

    const miningClaimUser1 = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user1, miaCityName, claimHeight)]);
    const miningClaimUser2 = chain.mineBlock([ccd006CityMiningV2.claimMiningReward(user2, miaCityName, claimHeight)]);

    // assert

    const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(miaCityId).result.expectTuple();
    // verify coinbase amounts
    const expectedAmounts = {
      cbaBonus: types.uint(10),
      cba1: types.uint(100),
      cba2: types.uint(1000),
      cba3: types.uint(10000),
      cba4: types.uint(100000),
      cba5: types.uint(1000000),
      cbaDefault: types.uint(10000000),
    };
    assertEquals(coinbaseInfo.amounts.expectSome().expectTuple(), expectedAmounts);
    // verify coinbase thresholds
    const expectedThresholds = {
      cbt1: types.uint(50),
      cbt2: types.uint(60),
      cbt3: types.uint(70),
      cbt4: types.uint(80),
      cbt5: types.uint(90),
    };
    assertEquals(coinbaseInfo.thresholds.expectSome().expectTuple(), expectedThresholds);

    miningBlock.receipts[0].result.expectOk().expectBool(true);
    miningBlock.receipts[1].result.expectOk().expectBool(true);

    let winner: number;

    if (miningClaimUser2.receipts[0].result === "(err u6014)") {
      //console.log("USER 1 WINS");
      miningClaimUser1.receipts[0].result.expectOk().expectBool(true);
      miningClaimUser2.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_ALREADY_CLAIMED);
      winner = 2;
    } else {
      //console.log("USER 2 WINS");
      miningClaimUser1.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINER_NOT_WINNER);
      miningClaimUser2.receipts[0].result.expectOk().expectBool(true);
      winner = 3;
    }

    miningBlock.receipts[0].events.expectSTXTransferEvent(10, user1.address, `${sender.address}.${miaTreasuryNameV2}`);
    miningBlock.receipts[1].events.expectSTXTransferEvent(10, user2.address, `${sender.address}.${miaTreasuryNameV2}`);
    // {cityId: u1, cityName: \"mia\", cityTreasury: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd002-treasury-mia-mining, event: \"mining\", firstBlock: u10, lastBlock: u10, totalAmount: u10, totalBlocks: u1, userId: u1}"}
    let expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(claimHeight)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(2)}}`;
    // console.log(JSON.stringify(miningBlock.receipts[0].events), null, 2);
    miningBlock.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);
    expectedPrintMsg = `{cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryNameV2}, event: "mining", firstBlock: ${types.uint(claimHeight)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(3)}}`;
    miningBlock.receipts[1].events.expectPrintEvent(`${sender.address}.ccd006-citycoin-mining-v2`, expectedPrintMsg);

    //dumpMiningData(ccd006CityMiningV2, miaCityId, (firstBlock), (1), miningStatsAt, minerAt);
    ccd006CityMiningV2.getRewardDelay().result.expectUint(rewardDelay);

    //ccd006CityMiningV2.getBlockWinner(miaCityId, firstBlock).result.expectUint(2);
    ccd006CityMiningV2.getBlockWinner(miaCityId, claimHeight).result.expectSome().expectUint(winner);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: set-mining-enabled() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    // act
    const block = chain.mineBlock([ccd006CityMiningV2.setMiningEnabled(sender, true)]);
    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: get-mining-enabled() returns true after deployment",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    // act
    passCcip014(chain, accounts);
    // assert
    ccd006CityMiningV2.isMiningEnabled().result.expectBool(true);
  },
});

// =============================
// 5. READ-ONLY FUNCTIONS
// =============================

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: get-coinbase-amount() returns u0 if coinbase info isn't set",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");

    // act
    const { result } = ccd006CityMiningV2.getCoinbaseAmount(miaCityId, 100);

    // assert
    result.expectUint(0);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: get-coinbase-amount() returns u0 if the city activation details do not exist",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    // get MIA/NYC city IDs
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set city status to activated
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // set city activation details
    // passProposal(PROPOSALS.TEST_CCD005_CITY_DATA_004);
    // set city coinbase amounts
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    // set city coinbase thresholds
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    // set city coinbase details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);

    // act
    const { result } = ccd006CityMiningV2.getCoinbaseAmount(miaCityId, 100);

    // assert
    result.expectUint(0);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: get-coinbase-amount() returns u0 if the block height is before the city's activation height",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    // get MIA/NYC city IDs
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set city status to activated
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // set city activation details
    // activation block = 10
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_004);
    // set city coinbase amounts
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    // set city coinbase thresholds
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    // set city coinbase details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);

    // act
    const { result } = ccd006CityMiningV2.getCoinbaseAmount(miaCityId, 5);

    // assert
    result.expectUint(0);
  },
});

Clarinet.test({
  name: "ccd006-citycoin-mining-v2: get-coinbase-amount() returns the expected amounts",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMiningV2 = new CCD006CityMining(chain, sender, "ccd006-citycoin-mining-v2");
    // get MIA/NYC city IDs
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set city activation details
    // activation block = 5
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set city status to activated
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // set city coinbase amounts
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    // set city coinbase thresholds
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    // set city coinbase details
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);

    // act
    const coinbaseInfo = ccd005CityData.getCityCoinbaseInfo(miaCityId).result.expectTuple();
    // verify coinbase amounts
    const expectedAmounts = {
      cbaBonus: types.uint(10),
      cba1: types.uint(100),
      cba2: types.uint(1000),
      cba3: types.uint(10000),
      cba4: types.uint(100000),
      cba5: types.uint(1000000),
      cbaDefault: types.uint(10000000),
    };

    // verify coinbase thresholds
    const expectedThresholds = {
      cbt1: types.uint(50),
      cbt2: types.uint(60),
      cbt3: types.uint(70),
      cbt4: types.uint(80),
      cbt5: types.uint(90),
    };

    // verify coinbase details
    const expectedDetails = {
      bonus: types.uint(20),
      epoch: types.uint(1),
    };

    // assert

    // const activation = ccd005CityData.getCityActivationDetails(miaCityId).result.expectSome().expectTuple();
    // console.log(`activation: ${JSON.stringify(activation)}`);

    // verify coinbase details
    assertEquals(coinbaseInfo.amounts.expectSome().expectTuple(), expectedAmounts);
    assertEquals(coinbaseInfo.thresholds.expectSome().expectTuple(), expectedThresholds);
    assertEquals(coinbaseInfo.details.expectSome().expectTuple(), expectedDetails);

    // get coinbase amount based on thresholds
    const thresholds = [25, 50, 60, 70, 80, 90];
    let counter = 0;
    for (const threshold of thresholds) {
      const { result } = ccd006CityMiningV2.getCoinbaseAmount(miaCityId, threshold);
      // console.log(`result for ${threshold}[${counter}]: ${result}`);
      assertEquals(result, expectedAmounts[Object.keys(expectedAmounts)[counter]]);
      counter++;
    }
  },
});
