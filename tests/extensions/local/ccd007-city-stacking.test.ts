/**
 * Test class is structured;
 * 0. AUTHORIZATION CHECKS
 * 1. set-pool-operator / set-reward-cycle-length
 * 2. stack
 * 3. send-stacking-reward
 * 4. claim-stacking-reward
 * 5. set-reward-cycle-length
 */
import { types, Account, assertEquals, Clarinet, Chain } from "../../../utils/deps.ts";
import { constructAndPassProposal, passProposal, PROPOSALS } from "../../../utils/common.ts";
import { CCD007CityStacking } from "../../../models/extensions/ccd007-city-stacking.model.ts";
import { CCD002Treasury } from "../../../models/extensions/ccd002-treasury.model.ts";
import { CCD003UserRegistry } from "../../../models/extensions/ccd003-user-registry.model.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================
const lockingPeriod = 32;
const rewardCycleLength = 100;
const miaCityName = "mia";
const nycCityName = "nyc";
const miaCityId = 1;

Clarinet.test({
  name: "ccd007-city-stacking: stack() fails if stacking is unavailable",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd007CityStacking = new CCD007CityStacking(chain, sender, "ccd007-city-stacking");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_002);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD007_CITY_STACKING_007);
    const block = chain.mineBlock([ccd007CityStacking.stack(sender, miaCityName, 5000, lockingPeriod)]);

    // assert
    block.receipts[0].result.expectErr().expectUint(CCD007CityStacking.ErrCode.ERR_TRANSFER_FAILED);
  },
});
