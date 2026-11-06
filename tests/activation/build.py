"""Activation integration fixture: real DAO/direct-execute/treasury policies.

Reuses the vault harness's market/token fixtures. Rebinds principals only in
generated files; production proposal, book and vault bytes remain untouched.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / '.build'
subprocess.run([sys.executable, str(ROOT / 'tests/vault/build.py'), '--output', str(OUT)], check=True)

def write(name, source):
    (OUT / 'contracts' / (name + '.clar')).write_text(source)

for name in ['ccd015-redemption-book-mia-stx', 'ccd016-swap-vault-mia-v2']:
    path = OUT / 'contracts' / (name + '.clar')
    path.write_text(path.read_text().replace('.mock-base-dao', '.base-dao'))

sources = {
    'proposal-trait': 'contracts/traits/proposal-trait.clar',
    'base-dao': 'contracts/base-dao.clar',
    'ccd001-direct-execute': 'contracts/extensions/ccd001-direct-execute.clar',
    'mock-treasury': 'contracts/extensions/ccd002-treasury-v3.clar',
    'stacking-trait': 'contracts/traits/stacking-trait.clar',
    'ccd002-trait': 'contracts/traits/ccd002-trait.clar',
    'nft-trait': 'contracts/traits/sip009-nft-trait.clar',
    'ccip028-activate-mia-fair-redemption': 'contracts/proposals/ccip028-activate-mia-fair-redemption.clar',
}
aliases = {
    "'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao": '.base-dao',
    "'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.proposal-trait": '.proposal-trait',
    "'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3": '.mock-treasury',
    "'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token": '.mock-ft',
    "'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard": '.sip-010-trait',
    "'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait": '.nft-trait.sip009-nft-trait',
    "'SP000000000000000000002Q6VF78.pox-4": "'ST000000000000000000002AMW42H.pox-4",
}
hashes = json.loads((OUT / 'source-hashes.json').read_text())
for name, relative in sources.items():
    original = (ROOT / relative).read_text()
    hashes[name] = hashlib.sha256(original.encode()).hexdigest()
    for old, new in aliases.items():
        original = original.replace(old, new)
    write(name, original)

# Addresses are obtained by the test from simnet; configure signers through
# an executive-only construct proposal with fixed fixture addresses passed in.
write('bootstrap', '''
(impl-trait .proposal-trait.proposal-trait)
(define-data-var approvers (list 5 principal) (list))
(define-constant OWNER tx-sender)
(define-public (configure (who (list 5 principal)))
 (begin (asserts! (is-eq tx-sender OWNER) (err u1))
 (asserts! (is-eq (len who) u5) (err u2)) (ok (var-set approvers who))))
(define-private (enable (who principal))
 (contract-call? .ccd001-direct-execute set-approver who true))
(define-public (execute (sender principal))
 (begin
  (asserts! (is-eq contract-caller .base-dao) (err u1))
  (try! (contract-call? .base-dao set-extension .ccd001-direct-execute true))
  (map enable (var-get approvers))
  (try! (contract-call? .ccd001-direct-execute set-signals-required u3))
  (try! (contract-call? .ccd001-direct-execute set-sunset-block (+ block-height u1000)))
  (ok true)))
''')
write('forwarder', '''
(define-public (run (sender principal))
 (contract-call? .ccip028-activate-mia-fair-redemption execute sender))
''')
# Strict MIA ledger: unlike the fuzz fixture, this suite explicitly mints
# sellers' balances and never creates MIA during a transfer.
mia = (ROOT / 'tests/vault/fixtures/mock-mia.clar').read_text()
start = mia.index('    (if (< (ft-get-balance miamicoin sender) amount)')
end = mia.index('    (ft-transfer?', start)
mia = mia[:start] + mia[end:]
mia += '\n(define-public (mint (amount uint) (who principal)) (ft-mint? miamicoin amount who))\n'
write('mock-mia', mia)

legacy = {'base-dao', 'ccd001-direct-execute', 'mock-treasury', 'ccd002-trait', 'stacking-trait', 'nft-trait', 'proposal-trait', 'bootstrap'}
manifest = '[project]\nname = "ccip028-activation"\ntelemetry = false\ncache_dir = "./.cache"\n[repl.analysis]\npasses = []\n'
for path in sorted((OUT / 'contracts').glob('*.clar')):
    name = path.stem
    version = 2 if name in legacy else 6
    manifest += f'\n[contracts.{name}]\npath = "contracts/{path.name}"\nclarity_version = {version}\nepoch = "latest"\n'
(OUT / 'Clarinet.toml').write_text(manifest)
(OUT / 'source-hashes.json').write_text(json.dumps(hashes, indent=2) + '\n')
print('Built activation fixture:', OUT)
