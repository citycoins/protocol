import { Account, assertEquals, Clarinet, Chain, types } from "../../utils/deps.ts";
import { START_BLOCK_CCD005, constructAndPassProposal, passProposal, PROPOSALS } from "../../utils/common.ts";
import { CCD005CityData } from "../../models/extensions/ccd005-city-data.model.ts";
import { CCD008CityActivation } from "../../models/extensions/ccd008-city-activation.model.ts";

// =============================
// INTERNAL DATA / FUNCTIONS
// =============================

const miaCityId = 1;
const nycCityId = 2;

const testExpectedCityDetails = (ccd005CityData: any, cityId: number, succeeded: number, delay: number, activated: number, threshold: number) => {
  const expectedStats = {
    succeeded: types.uint(succeeded),
    delay: types.uint(delay),
    activated: types.uint(activated),
    threshold: types.uint(threshold),
  };
  assertEquals(ccd005CityData.getCityActivationDetails(cityId).result.expectSome().expectTuple(), expectedStats);
};

// PUBLIC FUNCTIONS

Clarinet.test({
  name: "ccd008-city-activation: is-dao-or-extension() fails when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd008CityActivation = new CCD008CityActivation(chain, sender, "ccd008-city-activation");

    // assert
    ccd008CityActivation.isDaoOrExtension().result.expectErr().expectUint(CCD008CityActivation.ErrCode.ERR_UNAUTHORIZED);
  },
});

Clarinet.test({
  name: "ccd008-city-activation: callback() succeeds when called directly",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;
    const ccd008CityActivation = new CCD005CityData(chain, sender, "ccd008-city-activation");

    // act
    const { receipts } = chain.mineBlock([ccd008CityActivation.callback(sender, "test")]);

    // assert
    assertEquals(receipts.length, 1);
    receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "ccd008-city-activation: activate-city() fails to activate if signalled by same account",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const sender = accounts.get("deployer")!;

    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd008CityActivation = new CCD008CityActivation(chain, sender, "ccd008-city-activation");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);

    // there should be no signals yet
    ccd008CityActivation.getCityActivationSignals(nycCityId).result.expectUint(0);
    // city should not be activated
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    testExpectedCityDetails(ccd005CityData, nycCityId, 2, 2, 2, 2);

    let block = chain.mineBlock([ccd008CityActivation.activateCity(sender, 2, "memo 1")]);

    ccd008CityActivation.getCityActivationSignals(nycCityId).result.expectUint(1);
    // city should not be activated
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    // sender should have voted already
    ccd008CityActivation.getCityActivationVoter(2, sender.address).result.expectBool(true);
    // send second signal
    block = chain.mineBlock([ccd008CityActivation.activateCity(sender, 2, "memo 2")]);

    // assert
    ccd008CityActivation.getCityActivationSignals(nycCityId).result.expectUint(1);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    block.receipts[0].result.expectErr().expectUint(CCD008CityActivation.ErrCode.ERR_ALREADY_VOTED);
    testExpectedCityDetails(ccd005CityData, nycCityId, 2, 2, 2, 2);
  },
});

/* LEAVING TEST AS AN ARTIFACT
* Since ccd008 is still a draft it won't be in the initial CCIP-012 proposal.
* It can be added later, but until then, this test will fail.
*

Clarinet.test({
  name: "ccd008-city-activation: activate-city() succeeds if activated by two different voters",
  fn(chain: Chain, accounts: Map<string, Account>) {
    // arrange
    const approver1 = accounts.get("wallet_1")!;
    const sender = accounts.get("deployer")!;
    const ccd005CityData = new CCD005CityData(chain, sender, "ccd005-city-data");
    const ccd008CityActivation = new CCD008CityActivation(chain, sender, "ccd008-city-activation");

    // act
    constructAndPassProposal(chain, accounts, PROPOSALS.TEST_CCD004_CITY_REGISTRY_001);
    passProposal(chain, accounts, PROPOSALS.TEST_CCD005_CITY_DATA_001);
    ccd008CityActivation.getCityActivationSignals(nycCityId).result.expectUint(0);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);
    testExpectedCityDetails(ccd005CityData, nycCityId, 2, 2, 2, 2);

    let block = chain.mineBlock([ccd008CityActivation.activateCity(sender, 2, "memo 1")]);

    ccd008CityActivation.getCityActivationSignals(nycCityId).result.expectUint(1);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(false);

    block = chain.mineBlock([ccd008CityActivation.activateCity(approver1, 2, "memo 2")]);
    const claimHeight = block.height - 1;

    // assert
    ccd008CityActivation.getCityActivationVoter(nycCityId, sender.address).result.expectBool(true);
    ccd008CityActivation.getCityActivationVoter(nycCityId, approver1.address).result.expectBool(true);
    ccd008CityActivation.getCityActivationSignals(nycCityId).result.expectUint(2);
    ccd005CityData.isCityActivated(nycCityId).result.expectBool(true);
    block.receipts[0].result.expectOk();
    testExpectedCityDetails(ccd005CityData, nycCityId, claimHeight, 2, claimHeight + 2, 2);
  },
});

*/
