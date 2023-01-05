# CityCoins Protocol

## Introduction

CityCoins give communities the power to improve and program their cities.

## Code Management

### Tests

To be able to fully unit test the functionality contracts with external references (to deployed mainnet contracts)
are copied to a test folder - `tests/contracts/extensions` and the external references replaced by internal testable
target contracts (or stubs). The copy / filter task is automated by running the script here;

```bash
bash scripts/copy-contracts.sh
```

If you are unable to execute the script, run the following command to update the permissions then try again:

```bash
chmod 755 scripts/copy-contracts.sh
```

The difference between running the tests with the local, filtered contracts is the following changes
in Clarinet.toml;

```bash
[contracts.ccd006-city-mining]
path = "tests/contracts/extensions/ccd006-city-mining.clar"

[contracts.ccd007-city-stacking]
path = "tests/contracts/extensions/ccd007-city-stacking.clar"
```

would be replaced by the lines;

```bash
[contracts.ccd006-city-mining]
path = "contracts/extensions/ccd006-city-mining.clar"

[contracts.ccd007-city-stacking]
path = "contracts/extensions/ccd007-city-stacking.clar"
```

other contracts would follow the same pattern but these are the only two effected at time of writing. The additional tests
which test the local functionality reside in directory;

```bash
tests/extensions/local
```

and these tests would be expected to fail if the Clarinet.toml was switched to point to the original, unfiltered, contracts.

### Code Formatting

The following will report and fix formatting issues;

```bash
npx prettier -c .
npx prettier --write .
```

### Test Code Coverage

Generate code coverage report;

```bash
clarinet test --coverage
genhtml -o coverage_report coverage.lcov
open coverage_report/index.html
```

The generated files are not committed to the repository (coverage_report is git ignored).

## Purpose

This repository contains the base contract for the DAO and any related extensions.

The base DAO and DAO extensions will first be used to deploy a smart contract treasury per city with stacking capabilities following a successful vote on the changes [in CCIP-012](https://github.com/citycoins/governance/blob/main/ccips/ccip-012/ccip-012-stabilize-emissions-and-treasuries.md).

Additional DAO extensions will be added for each part of the protocol (registration, mining, stacking) following a successful vote on the changes [in CCIP-013](https://github.com/citycoins/governance/blob/main/ccips/ccip-013/ccip-013-stabilize-protocol-and-simplify-contracts.md).

Upon completion of both CCIPs this repository will supersede the protocol contracts in [citycoins/contracts](https://github.com/citycoins/contracts).

## Contributions

All are welcome! Please get in touch via the [CityCoins Discord](https://chat.citycoins.co) or jump right in and submit a pull request.
