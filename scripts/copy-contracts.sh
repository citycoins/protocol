#!/bin/bash -e
#
############################################################

export SERVICE=$1

printf "Working Directory: %s\n" "$(pwd)"

printf "Updating ccd006-city-mining.clar\n"

infile="contracts/extensions/ccd006-city-mining.clar"
outfile="tests/contracts/extensions/ccd006-city-mining.clar"
m1In=("'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-vrf-v2")
m1Out=".citycoin-vrf-v2"
m2In=("'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2")
m2Out=".test-ccext-governance-token-mia"
m3In=("'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2")
m3Out=".test-ccext-governance-token-nyc"

printf "  Source: %s\n" $infile
printf "  Destination: %s\n" $outfile

sed 's/'"${m1In[0]}"'/'$m1Out'/g;s/'"${m2In[0]}"'/'$m2Out'/g;s/'"${m3In[0]}"'/'$m3Out'/g;' $infile > $outfile

printf "Updating ccd007-city-stacking.clar\n"

infile="contracts/extensions/ccd007-city-stacking.clar"
outfile="tests/contracts/extensions/ccd007-city-stacking.clar"

printf "  Source: %s\n" $infile
printf "  Destination: %s\n" $outfile

sed 's/'"${m2In[0]}"'/'$m2Out'/g;s/'"${m3In[0]}"'/'$m3Out'/g;' $infile > $outfile

printf "Updating Clarinet.toml\n"

printf "  Source: %s\n" Clarinet.local.toml
printf "  Destination: %s\n" Clarinet.toml

cp Clarinet.local.toml Clarinet.toml

printf "Finished!\n"

exit 0;
