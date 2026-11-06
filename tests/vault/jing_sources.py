"""Pinned deployed Jing sources and explicit local-only fixture setup."""
from pathlib import Path
import hashlib, json
HERE = Path(__file__).resolve().parent
UPSTREAM = HERE / 'fixtures/upstream'

def checked_sources():
    metadata = json.loads((UPSTREAM / 'sources.json').read_text())
    sources = {}
    for name, item in metadata.items():
        path = HERE / 'fixtures/v6-market.clar' if name == 'markets-sbtc-stx-jing-v6-4' else UPSTREAM / (name + '.clar')
        source = path.read_text()
        assert hashlib.sha256(source.encode()).hexdigest() == item['sha256'], name
        sources[name] = source
    assert (HERE / 'fixtures/v6-market.clar').read_text() == sources['markets-sbtc-stx-jing-v6-4']
    return sources, {name: item['sha256'] for name, item in metadata.items()}

def balanced(source, start):
    depth = 0
    for i in range(start, len(source)):
        if source[i] == '(': depth += 1
        elif source[i] == ')':
            depth -= 1
            if depth == 0: return i + 1
    raise ValueError('unbalanced form')

def market_fixture(source, fault_controls=False):
    aliases = {"'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait": '.sip-010-trait.sip-010-trait',
      "'SPMV5HDZ4EMB8XY7HAYT3XW0DF7DZ4E8XEG2J1T8.pyth-lazer-oracle": '.mock-lazer-oracle',
      "'SPMV5HDZ4EMB8XY7HAYT3XW0DF7DZ4E8XEG2J1T8.pyth-lazer-decoder-v1": '.mock-lazer-oracle',
      '.jing-core-v6': '.mock-jing-core', '.jing-ladder-v1': '.mock-jing-ladder'}
    for old, new in aliases.items(): source = source.replace(old, new)
    # Execute the real initializer at fixture deployment; do not replace market entrypoints.
    source += '\n(unwrap-panic (initialize current-contract .mock-ft .mock-ft u100 u100 u1 u45))\n'
    if fault_controls:
        # Fault injection retained solely for the vault's zero-mid/park recovery branches.
        source += '\n(define-public (test-park (who principal)) (park-token-x (var-get current-cycle) (contract-call? .mock-lazer-oracle get-mid) who (get-token-x-depositors (var-get current-cycle))))\n'
        start = source.index('(define-public (refresh-mid')
        end = balanced(source, start)
        original = source[start:end]
        sig_end = balanced(original, original.index('(refresh-mid'))
        source = source[:start] + original[:sig_end] + ' (if (var-get test-zero-mid) (ok u0) ' + original[sig_end:-1] + '))' + source[end:]
        source += '\n(define-data-var test-zero-mid bool false)\n(define-public (test-zero-price (b bool)) (ok (var-set test-zero-mid b)))\n'
    return source
