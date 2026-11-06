#!/usr/bin/env python3
"""RV ccd016-final: build the Rendezvous project for the FINAL ccd016 vault.

Target: the source-pinned final contracts/extensions/ccd016-swap-vault-mia-v2.clar.
Source hashes are recorded in .build/source-hashes.json.
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
sys.path.insert(0, str(root / 'tests/vault'))
from jing_sources import checked_sources, market_fixture
out = here / '.build'
if out.exists():
    shutil.rmtree(out)
(out / 'contracts').mkdir(parents=True)
(out / 'settings').mkdir()

VAULT = 'ccd016-swap-vault-mia-v2'
BOOK = 'ccd015-redemption-book-mia-stx'
EXPECTED_VAULT_SHA = 'ac0c305f8bfcfd9f210fb37cba6e1f4d61a26ad40ed7ca4792beca948778502e'

# Exact final dependency IDs; no prefix aliases for obsolete Jing contracts.
replacements = [
    ("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4", '.v6-market'),
    ("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.swap-router-sbtc-stx-jing-v5-5", '.mock-router'),
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
upstream, hashes = checked_sources()
for n in (VAULT, BOOK):
    s = (root / f'contracts/extensions/{n}.clar').read_text()
    hashes[n] = hashlib.sha256(s.encode()).hexdigest()
    files[n] = s
if hashes[VAULT] != EXPECTED_VAULT_SHA:
    sys.exit(f'vault source changed: {hashes[VAULT]} != final final deployment source {EXPECTED_VAULT_SHA}')

assert hashes[BOOK] == 'b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f'
for n, s in list(files.items()):
    for a, b in replacements:
        s = s.replace(a, b)
    if n == 'v6-market':
        s = market_fixture(s)
    if n == VAULT:
        # (1) DAO gate -> deployer tx-sender, or the harness flag rv-dao that
        #     only harness wrappers / test-* functions raise (and drop again).
        start = s.index('(define-public (is-dao-or-extension)')
        end = balanced(s, start)
        s = s[:start] + "(define-public (is-dao-or-extension) (ok (asserts! (or (is-eq tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) (var-get rv-dao)) ERR_UNAUTHORIZED)))" + s[end:]
        s += '\n' + (here / 'harness.clar').read_text()
    (out / 'contracts' / f'{n}.clar').write_text(s)

manifest = '[project]\nname = "ccd016-final-rv"\ntelemetry = false\ncache_dir = "./.cache"\n[repl.analysis]\npasses = []\n'
for n in files:
    manifest += f'\n[contracts.{n}]\npath = "contracts/{n}.clar"\nclarity_version = 6\nepoch = "latest"\n'
(out / 'Clarinet.toml').write_text(manifest)
shutil.copy(root / 'settings/Devnet.toml', out / 'settings/Devnet.toml')
(out / 'source-hashes.json').write_text(json.dumps(hashes, indent=2) + '\n')
print('Built', out)
