/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. mine
 * 2. claim-mining-reward
 * 3. reward-delay
 */
import { types, Account, Clarinet, Chain, assert, assertEquals } from "../../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS, EXTENSIONS } from "../../../utils/common.ts";
import { CCD006CityMining } from "../../../models/extensions/ccd006-city-mining.model.ts";
import { CCD005CityData } from "../../../models/extensions/ccd005-city-data.model.ts";
import { CCEXTGovernanceToken } from "../../../models/external/test-ccext-governance-token.model.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const rewardDelay = 100;
const miaCityId = 1;
const miaCityName = "mia";
const miaTreasuryName = "ccd002-treasury-mia-mining";

Clarinet.test({
  name: "ccd006-city-mining: is-block-winner() correctly identifies winning miner who has not claimed",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const totalAmount = 10;
    const totalBlocks = 1;
    const entries: number[] = [10];
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING).result.expectOk().expectUint(0);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);

    const miningBlock = chain.mineBlock([ccd006CityMining.mine(user1, miaCityName, entries)]);
    // console.log(`miningBlock:\n${JSON.stringify(miningBlock, null, 2)}}`);
    const claimHeight = miningBlock.height - 1;
    const lastBlock = claimHeight + totalBlocks - 1;
    chain.mineEmptyBlock(rewardDelay + 1);

    // assert
    miningBlock.receipts[0].result.expectOk().expectBool(true);

    // Check stx transfer events
    miningBlock.receipts[0].events.expectSTXTransferEvent(10, user1.address, `${sender.address}.${miaTreasuryName}`);

    // Check mining events
    const expectedPrintMsg = `{action: "mining", cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, firstBlock: ${types.uint(claimHeight)}, lastBlock: ${types.uint(lastBlock)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(1)}}`;
    miningBlock.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-city-mining`, expectedPrintMsg);

    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING).result.expectOk().expectUint(0);
    const expected = {
      claimed: types.bool(false),
      winner: types.bool(true),
    };
    const isBlockWinner = ccd006CityMining.isBlockWinner(miaCityId, user1.address, claimHeight);
    //console.log(JSON.stringify(isBlockWinner, null, 2));
    // console.log(`isBlockWinner:\n${JSON.stringify(isBlockWinner, null, 2)}}`);
    assertEquals(isBlockWinner.result.expectSome().expectTuple(), expected);
    // TODO MJC: is-block-winner calculates the winning status of given user.
    // get-block-winner reads it from the map which is written by claim-mining-reward.
    // so user1 is not returned by the following even though previous lines indicate they won.
    //
    // JS: this is correct, since the map isn't written to until the reward is claimed,
    // we would expect the value to be none here while the output of isBlockWinner() above
    // will be (some (claimed false) (winner true)).
    ccd006CityMining.getBlockWinner(miaCityId, claimHeight).result.expectNone(); // expectSome().expectUint(1);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: is-block-winner() correctly identifies winning miner who has claimed",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const totalAmount = 10;
    const totalBlocks = 1;
    const entries: number[] = [10];
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING).result.expectOk().expectUint(0);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);

    const miningBlock = chain.mineBlock([ccd006CityMining.mine(user1, miaCityName, entries)]);
    const miningHeight = miningBlock.height - 1;
    chain.mineEmptyBlock(rewardDelay + 1);
    const miningClaimBlock = chain.mineBlock([ccd006CityMining.claimMiningBlock(user1, miaCityName, miningHeight)]);

    // assert
    miningBlock.receipts[0].result.expectOk().expectBool(true);
    // Check mining event
    let expectedPrintMsg = `{action: "mining", cityId: u1, cityName: "mia", cityTreasury: ${sender.address}.${miaTreasuryName}, firstBlock: ${types.uint(miningHeight)}, lastBlock: ${types.uint(miningHeight)}, totalAmount: ${types.uint(totalAmount)}, totalBlocks: ${types.uint(totalBlocks)}, userId: ${types.uint(1)}}`;
    miningBlock.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-city-mining`, expectedPrintMsg);
    // Check mining claim event
    expectedPrintMsg = `{action: "mining-claim", cityId: u1, cityName: "mia", claimHeight: ${types.uint(miningHeight)}, userId: ${types.uint(1)}}`;
    miningClaimBlock.receipts[0].events.expectPrintEvent(`${sender.address}.ccd006-city-mining`, expectedPrintMsg);
    // Check stx transfer events
    miningBlock.receipts[0].events.expectSTXTransferEvent(10, user1.address, `${sender.address}.${miaTreasuryName}`);
    // check mia token balances
    gt.getBalance(user1.address).result.expectOk().expectUint(10000000);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING).result.expectOk().expectUint(0);
    const expected = {
      claimed: types.bool(true),
      winner: types.bool(true),
    };
    assertEquals(ccd006CityMining.isBlockWinner(miaCityId, user1.address, miningHeight).result.expectSome().expectTuple(), expected);
    // TODO MJC: is-block-winner calculates the winning status of given user.
    // get-block-winner reads it from the map which is written by claim-mining-reward.
    // so user1 is not returned by the following even though previous lines indicate they won.
    ccd006CityMining.getBlockWinner(miaCityId, miningHeight).result.expectSome().expectUint(1);
  },
});

const twoMinersMine = (user1: Account, user2: Account, ccd006CityMining: CCD006CityMining, chain: Chain, sender: Account): any => {
  const entries: number[] = [10];
  const miningBlock = chain.mineBlock([ccd006CityMining.mine(user1, miaCityName, entries), ccd006CityMining.mine(user2, miaCityName, entries)]);
  const claimHeight = miningBlock.height - 1;
  chain.mineEmptyBlock(rewardDelay + 1);
  const miningClaimBlock = chain.mineBlock([ccd006CityMining.claimMiningBlock(user1, miaCityName, claimHeight), ccd006CityMining.claimMiningBlock(user2, miaCityName, claimHeight)]);

  miningBlock.receipts[0].events.expectSTXTransferEvent(10, user1.address, `${sender.address}.${miaTreasuryName}`);
  miningBlock.receipts[1].events.expectSTXTransferEvent(10, user2.address, `${sender.address}.${miaTreasuryName}`);
  let winner = 0;
  let coinbase = 0;
  if (miningClaimBlock.receipts[0].result === "(ok true)") {
    //console.log("======== USER 1 WINS =========================")
    ccd006CityMining.getBlockWinner(miaCityId, claimHeight).result.expectSome().expectUint(1);
    coinbase = Number(ccd006CityMining.getCoinbaseAmount(miaCityId, claimHeight).result.substring(1));
    miningClaimBlock.receipts[0].result.expectOk().expectBool(true);
    /**
    console.log("getCoinbaseAmount : " + coinbase)
    console.log("isBlockWinner : " + ccd006CityMining.isBlockWinner(miaCityId, user1.address, claimHeight).result.expectSome().expectTuple())
    console.log("getMiningStatsAtBlock : ", ccd006CityMining.getMiningStatsAtBlock(miaCityId, claimHeight))
    */
    winner = 1;
  } else if (miningClaimBlock.receipts[1].result === "(ok true)") {
    //console.log("======== USER 2 WINS =========================")
    ccd006CityMining.getBlockWinner(miaCityId, claimHeight).result.expectSome().expectUint(2);
    //miningClaimBlock.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINER_NOT_WINNER);
    miningClaimBlock.receipts[1].result.expectOk().expectBool(true);
    coinbase = Number(ccd006CityMining.getCoinbaseAmount(miaCityId, claimHeight).result.substring(1));
    winner = 2;
    /**
    console.log("getCoinbaseAmount : " + coinbase)
    console.log("isBlockWinner : " + ccd006CityMining.isBlockWinner(miaCityId, user2.address, claimHeight).result.expectSome().expectTuple())
    console.log("getMiningStatsAtBlock : ", ccd006CityMining.getMiningStatsAtBlock(miaCityId, claimHeight))
     */
  } else {
    console.log("======== NOONE WINS =========================");
    return 3;
  }
  return { miningBlock, miningClaimBlock, claimHeight, winner, coinbase };
  /**
  console.log("miningBlock receipts[0].result : " + miningBlock.receipts[0].result)
  console.log("miningBlock receipts[1].result : " + miningBlock.receipts[1].result)
  console.log("miningClaimBlock receipts[0].result : " + miningClaimBlock.receipts[0].result)
  console.log("miningClaimBlock receipts[1].result : " + miningClaimBlock.receipts[1].result)
  console.log(miningBlock.receipts[0].events[1].contract_event.value)
  console.log("claimHeight : " + claimHeight)
   */
};

Clarinet.test({
  name: "ccd006-city-mining: claim-mining-reward() two miners compete and each wins within 10% of half the time",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_MINING).result.expectOk().expectUint(0);

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    // add mining treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);

    // assert
    let result;
    let winner1 = 0;
    let winner2 = 0;
    let count1 = 0;
    let count2 = 0;
    const runs = 100;
    for (let i = 0; i < runs; i++) {
      result = twoMinersMine(user1, user2, ccd006CityMining, chain, sender);
      if (result.winner === 1) {
        count1 = count1 + result.coinbase;
        winner1++;
      } else if (result.winner === 2) {
        count2 = count2 + result.coinbase;
        winner2++;
      }
    }
    //console.log("winner1 = " + winner1);
    //console.log("winner2 = " + winner2);

    gt.getBalance(user1.address).result.expectOk().expectUint(count1);
    gt.getBalance(user2.address).result.expectOk().expectUint(count2);
    // ensure that each wins within 10% of half the time
    assert(winner1 > runs / 2 - (runs * 10) / 100);
    assert(winner2 > runs / 2 - (runs * 10) / 100);
  },
});

Clarinet.test({
  name: "ccd006-city-mining: claim-mining-reward() fails if user claims at incorrect height",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd006CityMining = new CCD006CityMining(chain, sender, "ccd006-city-mining");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_009);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_010);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_018);
    // add mining treasury
    passProposal(chain, accounts, PROPOSALS.TEST_CCD006_CITY_MINING_002);
    ccd005CityData.getCityTreasuryNonce(miaCityId).result.expectUint(1);

    // assert
    const entries: number[] = [10];
    const miningBlock = chain.mineBlock([ccd006CityMining.mine(user1, miaCityName, entries), ccd006CityMining.mine(user2, miaCityName, entries)]);
    const claimHeight = miningBlock.height - 1;
    chain.mineEmptyBlock(rewardDelay + 1);
    const miningClaimBlock = chain.mineBlock([ccd006CityMining.claimMiningBlock(user1, miaCityName, claimHeight + 1), ccd006CityMining.claimMiningBlock(user1, miaCityName, claimHeight - 1), ccd006CityMining.claimMiningBlock(user1, miaCityName, claimHeight)]);

    // assert
    miningClaimBlock.receipts[2].result.expectOk().expectBool(true);
    miningClaimBlock.receipts[1].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINER_DATA_NOT_FOUND);
    miningClaimBlock.receipts[0].result.expectErr().expectUint(CCD006CityMining.ErrCode.ERR_MINER_DATA_NOT_FOUND);
  },
});
