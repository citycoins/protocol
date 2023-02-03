#!/bin/bash -e
#
# TODO: update to account for testnet/mainnet values in contract
#
############################################################
# Copies clarity contracts to test directory and filters
# out references to mainet contracts
# must be run before > clarinet test
############################################################
infile=contracts/extensions/ccd006-citycoin-mining.clar
outfile=tests/contracts/extensions/ccd006-citycoin-mining.clar
m1In="'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-vrf-v2"
m1Out=".citycoin-vrf-v2"
m2In="'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2"
m2Out=".test-ccext-governance-token-mia"
m3In="'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2"
m3Out=".test-ccext-governance-token-nyc"

printf "Working Directory: `pwd`\n"
printf "Copying and replacing: $infile to $outfile\n"

sed 's/'$m1In'/'$m1Out'/g;s/'$m2In'/'$m2Out'/g;s/'$m3In'/'$m3Out'/g;' $infile > $outfile

infile=contracts/extensions/ccd007-citycoin-stacking.clar
outfile=tests/contracts/extensions/ccd007-citycoin-stacking.clar

printf "Copying and replacing: $infile to $outfile\n"

sed 's/'$m2In'/'$m2Out'/g;s/'$m3In'/'$m3Out'/g;' $infile > $outfile

printf "Finished!"

exit 0;
