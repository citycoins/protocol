import { Account, assertEquals, Clarinet, Chain, types } from "../../utils/deps.ts";
import { constructAndPassProposal, EXTENSIONS, mia, nyc, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD007CityStacking } from "../../models/extensions/ccd007-citycoin-stacking.model.ts";
import { CCIP014Pox3 } from "../../models/proposals/ccip014-pox-3.model.ts";
import { CCEXTGovernanceToken } from "../../models/external/test-ccext-governance-token.model.ts";

Clarinet.test({
  name: "ccip-014: execute() fails with ERR_VOTE_FAILED if there are no votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange

    // register MIA and NYC
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set activation details for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set activation status for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);

    // act

    // execute ccip-014
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_014);

    // assert
    block.receipts[2].result.expectErr().expectUint(CCIP014Pox3.ErrCode.ERR_VOTE_FAILED);
  },
});

Clarinet.test({
  name: "ccip-014: execute() fails with ERR_VOTE_FAILED if there are more no than yes votes",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-citycoin-stacking");
    const gt = new CCEXTGovernanceToken(chain, sender, "test-ccext-governance-token-mia");
    const ccip014pox3 = new CCIP014Pox3(chain, sender);

    const amountStacked = 500;
    const lockPeriod = 10;

    gt.getBalance(user1.address).result.expectOk().expectUint(0);
    gt.getBalance(EXTENSIONS.CCD002_TREASURY_MIA_STACKING).result.expectOk().expectUint(0);
    // progress the chain to avoid underflow in
    // stacking reward cycle calculation
    chain.mineEmptyBlockUntil(CCD007CityStacking.FIRST_STACKING_BLOCK);
    // register MIA and NYC
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    // set activation details for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    // set activation status for MIA and NYC
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    // add stacking treasury in city data
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    // mints mia to user1 and user2
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_009);
    // adds the token contract to the treasury allow list
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_010);

    // stack first cycle u1, last cycle u10
    const stackingBlock = chain.mineBlock([ccd007CityStacking.stack(user1, mia.cityName, amountStacked, lockPeriod), ccd007CityStacking.stack(user2, mia.cityName, amountStacked, lockPeriod)]);
    stackingBlock.receipts[0].result.expectOk().expectBool(true);
    stackingBlock.receipts[1].result.expectOk().expectBool(true);

    // progress the chain to cycle 4
    // votes are counted in cycles 2-3
    console.log(chain.mineEmptyBlockUntil(CCD007CityStacking.REWARD_CYCLE_LENGTH * 5 + 10));
    ccd007CityStacking.getCurrentRewardCycle().result.expectUint(4);

    console.log(ccd007CityStacking.getStacker(mia.cityId, 2, 1));
    console.log(ccd007CityStacking.getStacker(mia.cityId, 2, 2));

    // execute two no votes
    const votingBlock = chain.mineBlock([ccip014pox3.voteOnProposal(user1, false), ccip014pox3.voteOnProposal(user2, false)]);

    console.log(`voting block:\n${JSON.stringify(votingBlock, null, 2)}`);

    // act

    // execute ccip-014
    const block = passProposal(chain, accounts, PROPOSALS.CCIP_014);

    // assert
    block.receipts[2].result.expectErr().expectUint(CCIP014Pox3.ErrCode.ERR_VOTE_FAILED);
  },
});
