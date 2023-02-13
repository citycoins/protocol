# CityCoins Protocol

## Introduction

CityCoins give communities the power to improve and program their cities.

## Purpose

This repository contains the base contract for the CityCoins DAO and the related extensions required to implement [CCIP-012](https://github.com/citycoins/governance/blob/main/ccips/ccip-012/ccip-012-stabilize-emissions-and-treasuries.md) and [CCIP-013](https://github.com/citycoins/governance/blob/main/ccips/ccip-013/ccip-013-stabilize-protocol-and-simplify-contracts.md).

[More information can be found in the documentation.](https://docs.citycoins.co)

After the implementation of both CCIPs this repository will supersede the protocol contracts in [citycoins/contracts](https://github.com/citycoins/contracts).

## Code Management

### Prerequisites

- [clarinet](https://github.com/hirosystems/clarinet): for checking and testing Clarity contracts
- [lcov](https://github.com/linux-test-project/lcov) (opt): provides access to `genhtml` to view local code coverage reports
- [deno](https://deno.land/manual@v1.30.3/getting_started/installation) (opt): provides support for Clarinet testing structure

### Testing

All tests can be run with `clarinet --test`

Specific tests can be run as well:

```
clarinet --test tests/proposals/*
clarinet --test tests/extensions/ccd006-citycoin-mining.test.ts
```

### Continuous Integration

Any pull requests opened against the `main` or `develop` branch will trigger the CI, which:

- checks contract syntax with `clarinet --check`
- runs all contract tests with `clarinet test --coverage`
- uploads code coverage to [codecov](https://app.codecov.io/gh/citycoins/protocol)

### Code Formatting

A `.pretterignore` and `.prettierrc` configuration exist within the repo.

If you do not have prettier installed, it can be run via `npm`:

```bash
npx prettier -c .
npx prettier --write .
```

The first command checks the directory and reports any files that will be changed.

The second command writes the changes.

### Code Coverage

To generate a code coverage report:

```bash
clarinet test --coverage
genhtml -o coverage_report coverage.lcov
open coverage_report/index.html
```

The generated files are not committed to the repository (coverage_report is git ignored).

### Cost Testing

To view the costs for all tested functions:

```bash
clarinet test --costs
```

The table output is the same format as the entries saved in the `costs/` folder.

A manual diff is possible but requires some tweaking:

1. Run `clarinet test --costs > costs/name_of_baseline`
2. Remove everything above the line `Contract calls cost synthesis`
3. Make any changes as part of the PR
4. Run `clarinet test --costs > costs/name_of_change`
5. Remove everything above the line `Contract calls cost synthesis`
6. Run `git diff --no-index costs/name_of_baseline costs/name_of_change`

This will show the results side-by-side, and is much more readable with a diff tool like [delta](https://github.com/dandavison/delta) and the results stretched across two monitors.

## Contributions

All are welcome! Feel free to [submit an issue](https://github.com/citycoins/protocol/issues) or [open a pull request](https://github.com/citycoins/protocol/pulls).
