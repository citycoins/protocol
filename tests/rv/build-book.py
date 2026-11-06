"""Self-contained final-book RV project; no root manifest or sibling checkout."""
from pathlib import Path
import sys, hashlib, json, shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT/'tests/vault'))
from jing_sources import balanced
OUT=HERE/'.build-book'
(OUT/'contracts').mkdir(parents=True,exist_ok=True)
(OUT/'settings').mkdir(exist_ok=True)
name='ccd015-redemption-book-mia-stx'
s=(ROOT/f'contracts/extensions/{name}.clar').read_text()
h=hashlib.sha256(s.encode()).hexdigest()
assert h=='b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f'
replacements={
"'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.extension-trait":'.extension-trait',
"'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2":'.mock-mia',
"'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token":'.mock-mia-v1',
"'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-mining-v3":"'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP",
"'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X.ccd014-pox5-staking-mia":"'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6",
'(define-data-var min-deposit uint (* u100000 MICRO_CITYCOINS))':'(define-data-var min-deposit uint u1000)'}
for a,b in replacements.items():
 assert a in s,a
 s=s.replace(a,b)
a=s.index('(define-public (is-dao-or-extension)');b=balanced(s,a)
s=s[:a]+"(define-public (is-dao-or-extension) (ok (asserts! (is-eq tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) ERR_UNAUTHORIZED)))"+s[b:]
s+='\n'+(HERE/f'{name}.invariants.clar').read_text()
(OUT/'contracts'/f'{name}.clar').write_text(s)
for n in ['mock-mia','mock-mia-v1','extension-trait','sip-010-trait']:
 shutil.copy(ROOT/'tests/vault/fixtures'/f'{n}.clar',OUT/'contracts'/f'{n}.clar')
manifest='[project]\nname="ccd015-final-rv"\ntelemetry=false\ncache_dir=".cache"\n[repl.analysis]\npasses=[]\n'
for p in sorted((OUT/'contracts').glob('*.clar')):
 manifest+=f'\n[contracts.{p.stem}]\npath="contracts/{p.name}"\nclarity_version=6\nepoch="latest"\n'
(OUT/'Clarinet.toml').write_text(manifest)
shutil.copy(ROOT/'settings/Devnet.toml',OUT/'settings/Devnet.toml')
(OUT/'source-hashes.json').write_text(json.dumps({name:h},indent=2)+'\n')
print('Built',OUT)
