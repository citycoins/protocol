#!/usr/bin/env python3
"""RV ccd016-final: build the Rendezvous project for the FINAL ccd016 vault.

Target: contracts/extensions/ccd016-swap-vault-mia-v2.clar as of 8bfbb5f
(unchanged to HEAD; the sha256 is recorded in .build/source-hashes.json).
Production files are only read. Fixtures come from tests/vault/fixtures,
except the three overridden in ./mocks (adversarial router, fee-charging
Lazer oracle, FT ledger with a vault-outflow ghost). The vault copy gets the
test-only rewrites listed in tests/rv/README.md and harness.clar appended.
Output: tests/rv/ccd016-final/.build/ (gitignored)."""
from pathlib import Path
import hashlib, json, shutil, sys

here = Path(__file__).resolve().parent
root = here.parents[2]
fixtures = root / 'tests/vault/fixtures'
out = here / '.build'
if out.exists():
    shutil.rmtree(out)
(out / 'contracts').mkdir(parents=True)
(out / 'settings').mkdir()

VAULT = 'ccd016-swap-vault-mia-v2'
BOOK = 'ccd015-redemption-book-mia-stx'
EXPECTED_VAULT_SHA = 'e3437fcfe248b46e11ffee8b37e88d227211387afca099db1502c8b231133720'

# Same address rewrites as tests/vault/build.py (the -v6-3 / -v5-3 ids first).
replacements = [
    ("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-3", '.v6-market'),
    ("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.swap-router-sbtc-stx-jing-v5-3", '.mock-router'),
    ("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6", '.v6-market'),
    ("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.swap-router-sbtc-stx-jing-v5", '.mock-router'),
    ("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.rfq-sbtc-stx-jing-v2-3", '.mock-native'),
    ("'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token", '.mock-ft'),
    ("'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2", '.mock-ft'),
    ("'SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0.dia-oracle", '.mock-dia'),
    ("'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao", '.mock-base-dao'),
    ("'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.extension-trait", '.extension-trait'),
    ("'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3", '.mock-treasury'),
    ("'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2", '.mock-mia'),
    ("'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token", '.mock-mia-v1'),
    ("'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-mining-v3", "'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP"),
    ("'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X.ccd014-pox5-staking-mia", "'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6"),
    ('"sbtc-token"', '"mock-ft"'),
]

def balanced(s, start):
    depth = 0
    for i in range(start, len(s)):
        if s[i] == '(':
            depth += 1
        elif s[i] == ')':
            depth -= 1
            if depth == 0:
                return i + 1
    raise ValueError('unbalanced')

def sub_once(s, old, new, what):
    assert s.count(old) == 1, f'{what}: expected exactly one match, got {s.count(old)}'
    return s.replace(old, new)

files = {p.stem: p.read_text() for p in fixtures.glob('*.clar')}
for p in (here / 'mocks').glob('*.clar'):
    files[p.stem] = p.read_text()
hashes = {}
for n in (VAULT, BOOK):
    s = (root / f'contracts/extensions/{n}.clar').read_text()
    hashes[n] = hashlib.sha256(s.encode()).hexdigest()
    files[n] = s
if hashes[VAULT] != EXPECTED_VAULT_SHA and '--any-source' not in sys.argv:
    sys.exit(f'vault source changed: {hashes[VAULT]} != final 8bfbb5f {EXPECTED_VAULT_SHA} (pass --any-source to build anyway)')

for n, s in list(files.items()):
    for a, b in replacements:
        s = s.replace(a, b)
    if n == 'v6-market':
        # Same v6-3 compatibility shims as tests/vault/build.py (fixture market
        # predates v6-3: pending-escrow getter, update-less deposit/limit).
        if '(define-read-only (get-token-x-pending-deposit' not in s:
            s += '\n(define-map token-x-pending-deposits principal {amount: uint, limit: uint, spread-bps: (optional uint), submitted-at: uint})\n(define-read-only (get-token-x-pending-deposit (depositor principal)) (map-get? token-x-pending-deposits depositor))\n'
        for fn, sig, args in [
            ('deposit-token-x', '(amount uint) (limit-price uint) (spread-bps (optional uint)) (t <ft-trait>) (asset-name (string-ascii 128))', 'amount limit-price spread-bps 0x t asset-name'),
            ('set-token-x-limit', '(limit-price uint) (spread-bps (optional uint))', 'limit-price spread-bps 0x'),
        ]:
            s = sub_once(s, f'(define-public ({fn}\n', f'(define-public ({fn}-fixture-v6\n', fn)
            s = sub_once(s, f'  ({fn} ', f'  ({fn}-fixture-v6 ', fn)
            s += f'(define-public ({fn} {sig}) ({fn}-fixture-v6 {args}))\n'
    if n == VAULT:
        # (1) DAO gate -> deployer tx-sender, or the harness flag rv-dao that
        #     only harness wrappers / test-* functions raise (and drop again).
        start = s.index('(define-public (is-dao-or-extension)')
        end = balanced(s, start)
        s = s[:start] + "(define-public (is-dao-or-extension) (ok (asserts! (or (is-eq tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) (var-get rv-dao)) ERR_UNAUTHORIZED)))" + s[end:]
        # (2) patience window default 288 -> 400 burn blocks: a window survives a few RV
        #     runs (<= 100 burn blocks mined per run at 1000 runs); rv-dao-config
        #     moves it to 0-40 (1 in 4) or 60-300 so both phases recur.
        s = sub_once(s, '(define-data-var window-blocks uint u288)', '(define-data-var window-blocks uint u400)', 'window default')
        s += '\n' + (here / 'harness.clar').read_text()
    (out / 'contracts' / f'{n}.clar').write_text(s)

manifest = '[project]\nname = "ccd016-final-rv"\ntelemetry = false\ncache_dir = "./.cache"\n[repl.analysis]\npasses = []\n'
for n in files:
    manifest += f'\n[contracts.{n}]\npath = "contracts/{n}.clar"\nclarity_version = 6\nepoch = "latest"\n'
(out / 'Clarinet.toml').write_text(manifest)
shutil.copy(root / 'settings/Devnet.toml', out / 'settings/Devnet.toml')
(out / 'source-hashes.json').write_text(json.dumps(hashes, indent=2) + '\n')
print('Built', out)
