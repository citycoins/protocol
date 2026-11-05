#!/usr/bin/env python3
"""Compile current vault/book against self-contained test dependencies; production untouched."""
from pathlib import Path
import sys,shutil,json,hashlib
here=Path(__file__).resolve().parent;root=here.parents[1];rv='--rv' in sys.argv
out=Path(sys.argv[sys.argv.index('--output')+1]).resolve() if '--output' in sys.argv else here/('.build-rv' if rv else '.build')
(out/'contracts').mkdir(parents=True,exist_ok=True);(out/'settings').mkdir(exist_ok=True)
EXPECTED_BOOK_SHA256='b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f'
replacements={
# the -v6-4 / -v5-5 ids first: the bare -v6 / -v5 prefixes below would otherwise leave a stray suffix
"'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4":'.v6-market',
"'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.swap-router-sbtc-stx-jing-v5-5":'.mock-router',
"'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6":'.v6-market',
"'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.swap-router-sbtc-stx-jing-v5":'.mock-router',
"'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.rfq-sbtc-stx-jing-v2-3":'.mock-native',
"'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token":'.mock-ft',
"'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2":'.mock-ft',
"'SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0.dia-oracle":'.mock-dia',
"'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao":'.mock-base-dao',
"'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.extension-trait":'.extension-trait',
"'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3":'.mock-treasury',
"'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2":'.mock-mia',
"'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token":'.mock-mia-v1',
"'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-mining-v3":"'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP",
"'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X.ccd014-pox5-staking-mia":"'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6",
'"sbtc-token"':'"mock-ft"'}
files={p.stem:p.read_text() for p in (here/'fixtures').glob('*.clar')};hashes={}
files['mock-book-extension']=''';; Test-only extension that forwards admin calls through contract-caller.
(define-public (set-paused (paused bool))
  (contract-call? .ccd015-redemption-book-mia-stx set-paused paused)
)
(define-public (set-min-deposit (amount uint))
  (contract-call? .ccd015-redemption-book-mia-stx set-min-deposit amount)
)
(define-public (update-par)
  (contract-call? .ccd015-redemption-book-mia-stx update-par)
)
'''
for index in range(51):
 name=f'mock-book-seller-{index}'
 files[name]=f'''(define-public (place (amount uint) (ask uint))
  (as-contract? ((with-ft .mock-mia "miamicoin" amount))
    (try! (contract-call? .ccd015-redemption-book-mia-stx place-offer amount ask))))
(define-public (cancel)
  (as-contract? () (try! (contract-call? .ccd015-redemption-book-mia-stx cancel-offer))))
'''
for n in ['ccd016-swap-vault-mia-v2','ccd015-redemption-book-mia-stx']:
 s=(root/f'contracts/extensions/{n}.clar').read_text();hashes[n]=hashlib.sha256(s.encode()).hexdigest();files[n]=s
if hashes['ccd015-redemption-book-mia-stx'] != EXPECTED_BOOK_SHA256:
 raise SystemExit(f"Unexpected ccd015-redemption-book-mia-stx source bytes: {hashes['ccd015-redemption-book-mia-stx']}; expected {EXPECTED_BOOK_SHA256}")
for n,s in files.items():
 for a,b in replacements.items():s=s.replace(a,b)
 if n=='v6-market':
  # ccd016 v2 uses the v6-4 pending-escrow getter from read-only paths.
  # Keep this local fixture compatible without changing the checked-in .clar fixture.
  if '(define-read-only (get-token-x-pending-deposit' not in s:
   s+='\n(define-map token-x-pending-deposits principal {amount: uint, limit: uint, spread-bps: (optional uint), submitted-at: uint})\n(define-read-only (get-token-x-pending-deposit (depositor principal)) (map-get? token-x-pending-deposits depositor))\n'
  # The checked-in market fixture models the prior update-bearing entrypoints.
  # ccd016 calls the deployed v6-4 signatures, which omit that update argument.
  for fn,sig,args in [('deposit-token-x','(amount uint) (limit-price uint) (spread-bps (optional uint)) (t <ft-trait>) (asset-name (string-ascii 128))','amount limit-price spread-bps 0x t asset-name'),
                      ('set-token-x-limit','(limit-price uint) (spread-bps (optional uint))','limit-price spread-bps 0x')]:
   assert s.count(f'(define-public ({fn}\n')==1,fn
   s=s.replace(f'(define-public ({fn}\n',f'(define-public ({fn}-fixture-v6\n')
   assert s.count(f'  ({fn} ')==1,fn
   s=s.replace(f'  ({fn} ',f'  ({fn}-fixture-v6 ')
   s+=f'(define-public ({fn} {sig}) ({fn}-fixture-v6 {args}))\n'
  s+='\n(define-public (test-park (who principal)) (park-token-x (var-get current-cycle) (contract-call? .mock-lazer-oracle get-mid) who (get-token-x-depositors (var-get current-cycle))))\n'
  start=s.index('(define-public (refresh-mid');depth=0
  for i in range(start,len(s)):
   if s[i]=='(':depth+=1
   elif s[i]==')':
    depth-=1
    if depth==0:end=i+1;break
  original=s[start:end];first=original.index('\n')+1;body=original[first:].rsplit(')',1)[0]
  s=s[:start]+original[:first]+' (if (var-get test-zero-mid) (ok u0) '+body+'))'+s[end:]
  s='(define-data-var test-zero-mid bool false)\n(define-public (test-zero-price (b bool)) (ok (var-set test-zero-mid b)))\n'+s
 if rv and n=='ccd016-swap-vault-mia-v2':
  start=s.index('(define-public (is-dao-or-extension)');depth=0
  for i in range(start,len(s)):
   if s[i]=='(':depth+=1
   elif s[i]==')':
    depth-=1
    if depth==0:end=i+1;break
  s=s[:start]+"(define-public (is-dao-or-extension) (ok (asserts! (is-eq tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) ERR_UNAUTHORIZED)))"+s[end:]
  s+='\n'+(here/'rv.invariants.clar').read_text()
 (out/f'contracts/{n}.clar').write_text(s)
manifest='[project]\nname = "citycoins-vault-runtime"\ntelemetry = false\ncache_dir = "./.cache"\n[repl.analysis]\npasses = []\n'
for n in files:manifest+=f'\n[contracts.{n}]\npath = "contracts/{n}.clar"\nclarity_version = 6\nepoch = "latest"\n'
(out/'Clarinet.toml').write_text(manifest);shutil.copy(root/'settings/Devnet.toml',out/'settings/Devnet.toml');(out/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n');print('Built',out)
