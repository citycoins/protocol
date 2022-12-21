# CityCoins Protocol

## Introduction

CityCoins give communities the power to improve and program their cities.

## Code Management

### Tests

In order to be able to fully unit test the functionality within the mining and stacking contracts
the tests run in one of two modes;

- local
- default

The default way to run the tests is to copy Clarinet.toml.default to Clarinet.toml.

This will run the tests against the two deployed contracts;

```bash
contracts/extensions/ccd006-city-mining.clar
contracts/extensions/ccd007-city-stacking.clar
```

By copying Clarinet.toml.local to Clarinet.toml the test will be run against;

```bash
tests/contracts/extensions/ccd006-city-mining.clar
tests/contracts/extensions/ccd007-city-stacking.clar
```

The two sets of contracts differ only in that references to mainnet contracts in the former have been
replaced with references to local sip-010 test contracts.

The extra tests, only applicable to `local` mode, are found in a separate test directory;

```bash
tests/contracts/extensions/local/
```

They will need to filtered/removed from the unit test run when running in default mode.

#### Automation of Above

To automate the above strategy we can create a wrapper script for `clarinet test` which
copies / filters the mining and stacking contracts and copies the `clarinet.toml.local` file to
`clarinet.toml`. Running the tests in local mode will include the tests in the `tests/extensions/local`
directory. Running them in integration mode will exclude these tests.

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
