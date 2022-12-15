/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. MINING
 *    - mine
 * 2. CLAIMING
 *    - claim-mining-reward
 *    - set-reward-delay
 */
import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD006CityMining } from "../../models/extensions/ccd006-city-mining.model.ts";
import { CCD002Treasury } from "../../models/extensions/ccd002-treasury.model.ts";
import { CCD003UserRegistry } from "../../models/extensions/ccd003-user-registry.model.ts";
import { CCD005CityData } from "../../models/extensions/ccd005-city-data.model.ts";
import { types } from "../../utils/deps.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const miaCityId = 1;
const miaCityName = "mia";
const miaTreasuryId = 1;
const miaMiningTreasuryName = "mining";
const miaTreasuryName = "ccd002-treasury-mia";

const dumpMiningData = (ccd006CityMining: any, cityId: number, height: number, userId: number) => {
  ccd006CityMining.getMiningStatsAtBlock(cityId, height).result.expectTuple();
  console.log("getMiningStatsAtBlock: " + ccd006CityMining.getMiningStatsAtBlock(cityId, height).result);
  console.log("hasMinedAtBlock: " + ccd006CityMining.hasMinedAtBlock(cityId, height, userId).result);
  console.log("getMinerAtBlock: " + ccd006CityMining.getMinerAtBlock(cityId, height, userId).result);
  console.log("getBlockWinner: " + ccd006CityMining.getBlockWinner(cityId, height).result);
  //console.log(ccd006CityMining.isBlockWinner(miaCityId, sender.address, (firstBlock + 100) ).result);
  console.log("getHighValue: " + ccd006CityMining.getHighValue(cityId, height).result);
  console.log("getCoinbaseAmount: " + ccd006CityMining.getCoinbaseAmount(cityId, height).result);
  console.log("getRewardDelay: " + ccd006CityMining.getRewardDelay().result);
};

// =============================
// 0. AUTHORIZATION CHECKS
// =============================

Clarinet.test({
  name: "ccd006-city-mining: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act

    // assert
    ccd006CityMining.isDaoOrExtension().result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_UNAUTHORIZED);
  },
});

// =============================
// 1. MINING
// =============================

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if city is not registered",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries = [10, 10];
    const { receipts } = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_CITY_ID_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if city is not active",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries = [10, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_CITY_NOT_ACTIVATED);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if city details are not set",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries = [10, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    //passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_CITY_DETAILS_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if city treasury is not set",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries = [10, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_CITY_TREASURY_NOT_FOUND);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if mining contract is not a valid dao extension",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries = [10, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_001);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    ccd005CityData.getCityTreasuryId(miaCityId, miaMiningTreasuryName).result.expectSome().expectUint(1);
    ccd005CityData.getCityTreasuryName(miaCityId, miaTreasuryId).result.expectSome().expectAscii(miaMiningTreasuryName);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD003UserRegistry.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if city has been de-activated",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries = [10, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_003);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    ccd005CityData.getCityTreasuryId(miaCityId, miaMiningTreasuryName).result.expectSome().expectUint(1);
    ccd005CityData.getCityTreasuryName(miaCityId, miaTreasuryId).result.expectSome().expectAscii(miaMiningTreasuryName);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_CITY_NOT_ACTIVATED);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails called with no commit amounts",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries: number[] = [];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    ccd005CityData.getCityTreasuryId(miaCityId, miaMiningTreasuryName).result.expectSome().expectUint(1);
    ccd005CityData.getCityTreasuryName(miaCityId, miaTreasuryId).result.expectSome().expectAscii(miaMiningTreasuryName);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INVALID_COMMIT_AMOUNTS);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if a commit amount is insufficient",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries: number[] = [10, 0, 10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_INSUFFICIENT_COMMIT);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() successfully mines 1 block",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    const entries: number[] = [10];
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert
    const firstBlock = 7;
    const lastBlock = 7;
    const totalAmount = 10;
    const totalBlocks = 1;
    const userId = 1;
    block.receipts[0].events.expectSTXTransferEvent(10, sender.address, `${sender.address}.${miaTreasuryName}`);
    const expectedPrintMsg = `{action: "mining", cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userId)}}`;

    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-city-mining`, expectedPrintMsg);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: mine() fails if already mined",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia");
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");
    const firstBlock = 7;
    const lastBlock = 9;
    const totalAmount = 30;
    const totalBlocks = 3;
    const userId = 1;
    const entries: number[] = [10, 10, 10];

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    const block = chain.mineBlock([ccd006CityMining.mine(sender, miaCityName, entries), ccd006CityMining.mine(sender, miaCityName, entries)]);

    // assert

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    //dumpMiningData(ccd006CityMining, miaCityId, firstBlock, userId);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);

    block.receipts[0].events.expectSTXTransferEvent(totalAmount, sender.address, `${sender.address}.${miaTreasuryName}`);
    block.receipts[1].events.expectSTXTransferEvent(totalAmount, sender.address, `${sender.address}.${miaTreasuryName}`);

    const expectedPrintMsg = `{action: "mining", cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userId)}}`;

    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-city-mining`, expectedPrintMsg);

    block.receipts[1].events.expectPrintEvent(`${sender.address}.ccd006-city-mining`, expectedPrintMsg);

    // Expecting ERR_ALREADY_MINED if same user tried mine twice at same height ?
    block.receipts[1].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_ALREADY_MINED);
    // and for the treasury balance to show the first tx only ..
    ccd002Treasury.getBalanceStx().result.expectUint(totalAmount);
  },
});

/**
 * this test splits the txs into separate blocks but doesn't show any difference to above/ 
Clarinet.test({
  name: "ccd006-city-mining: mine() fails if already mined in previous block",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd002Treasury = new CCD002Treasury(
      chain,
      sender,
      "ccd002-treasury-mia"
    );
    const ccd005CityData = new CCD005CityData(
      chain,
      sender,
      "ccd005-city-data"
    );
    const ccd006CityMining = new CCD006CityMining(
      chain,
      sender,
      "ccd006-city-mining"
    );
    const firstBlock = 7;
    const lastBlock = 9;
    const totalAmount = 30;
    const totalBlocks = 3;
    const userId = 1;
    const entries: number[] = [10, 10, 10];

    // act
    constructAndPassProposal(
      chain,
      accounts,
      PROPOSALS.TEST_CCD004_CITY_REGISTRY_001
    );
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);

    const block1 = chain.mineBlock([
      ccd006CityMining.mine(sender, miaCityName, entries),
    ]);
    const block2 = chain.mineBlock([
      ccd006CityMining.mine(sender, miaCityName, entries),
    ]);

    // assert

    block1.receipts[0].result.expectOk().expectBool(true);
    block2.receipts[0].result.expectOk().expectBool(true);
    //dumpMiningData(ccd006CityMining, miaCityId, firstBlock, userId);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);

    block1.receipts[0].events.expectSTXTransferEvent(
      totalAmount,
      sender.address,
      `${sender.address}.${miaTreasuryName}`
    );
    block2.receipts[0].events.expectSTXTransferEvent(
      totalAmount,
      sender.address,
      `${sender.address}.${miaTreasuryName}`
    );

    const expectedPrintMsg1 = `{action: "mining", cityId: u1, cityName: "mia", cityTreasury: ${
      sender.address
    }.${miaTreasuryName}, firstBlock: ${types.uint(
      firstBlock
    )}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(
      totalAmount
    )}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(
      userId
    )}}`;
    block1.receipts[0].events.expectPrintEvent(
      `${sender.address}.ccd006-city-mining`,
      expectedPrintMsg1
    );

    const expectedPrintMsg2 = `{action: "mining", cityId: u1, cityName: "mia", cityTreasury: ${
      sender.address
    }.${miaTreasuryName}, firstBlock: ${types.uint(
      firstBlock + 1
    )}, lastBlock: ${types.uint(lastBlock + 1)}, totalAmount: ${types.uint(
      totalAmount
    )}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(
      userId
    )}}`;
    block2.receipts[0].events.expectPrintEvent(
      `${sender.address}.ccd006-city-mining`,
      expectedPrintMsg2
    );

    // Expecting ERR_ALREADY_MINED if same user tried mine twice at same height ?
    block2.receipts[0].result
      .expectErr()
      .expectUint(CCD006CityMining.ErrCode.ERR_ALREADY_MINED);
    // and for the treasury balance to show the first tx only ..
    ccd002Treasury.getBalanceStx().result.expectUint(totalAmount);
  },
});
**/

Clarinet.test({
  name: "ccd006-city-mining: mine() allows 4 users to mine concurrently",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const user3 = accounts.get("wallet_3")!;
    const user4 = accounts.get("wallet_4")!;

    const ccd002Treasury = new CCD002Treasury(chain, sender, "ccd002-treasury-mia");
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");
    const ccd003UserRegistry = new CCD003UserRegistry(chain, sender, "ccd003-user-registry");

    const firstBlock = 7;
    const lastBlock = 9;
    const totalAmount = 120;
    const totalBlocks = 3;
    const userId = 1;
    const entries: number[] = [10, 10, 10];

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    const block = chain.mineBlock([ccd006CityMining.mine(user1, miaCityName, entries), ccd006CityMining.mine(user2, miaCityName, entries), ccd006CityMining.mine(user3, miaCityName, entries), ccd006CityMining.mine(user4, miaCityName, entries)]);

    // assert

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result.expectOk().expectBool(true);
    block.receipts[3].result.expectOk().expectBool(true);

    ccd002Treasury.getBalanceStx().result.expectUint(totalAmount);

    ccd003UserRegistry.getUser(1).result.expectSome().expectPrincipal(user1.address);
    ccd003UserRegistry.getUserId(user1.address).result.expectSome().expectUint(1);
    ccd003UserRegistry.getUserId(user2.address).result.expectSome().expectUint(2);
    ccd003UserRegistry.getUserId(user3.address).result.expectSome().expectUint(3);
    ccd003UserRegistry.getUserId(user4.address).result.expectSome().expectUint(4);

    dumpMiningData(ccd006CityMining, miaCityId, firstBlock, userId);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);

    block.receipts[0].events.expectSTXTransferEvent(30, user1.address, `${sender.address}.${miaTreasuryName}`);
    block.receipts[1].events.expectSTXTransferEvent(30, user2.address, `${sender.address}.${miaTreasuryName}`);
    block.receipts[2].events.expectSTXTransferEvent(30, user3.address, `${sender.address}.${miaTreasuryName}`);
    block.receipts[3].events.expectSTXTransferEvent(30, user4.address, `${sender.address}.${miaTreasuryName}`);

    const expectedPrintMsg = `{action: "mining", cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, firstBlock: ${types.uint(firstBlock)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(userId)}}`;

    block.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-city-mining`, expectedPrintMsg);

    block.receipts[1].events.expectPrintEvent(`${sender.address}.ccd006-city-mining`, expectedPrintMsg);

    // Expecting ERR_ALREADY_MINED if same user tried mine twice at same height ?
    block.receipts[1].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_ALREADY_MINED);
    // and for the treasury balance to show the first tx only ..
    ccd002Treasury.getBalanceStx().result.expectUint(totalAmount);
  },
});

// =============================
// 2. CLAIMING
// =============================
