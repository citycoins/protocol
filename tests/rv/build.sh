#!/bin/bash
# Self-contained targets; writes only under tests/.
set -eu
cd "$(dirname "$0")/../.."
case "${1:-all}" in
 ccd015-redemption-book-mia-stx) python3 tests/rv/build-book.py ;;
 ccd016-swap-vault-mia-v2) python3 tests/vault/build.py --rv ;;
 all) python3 tests/rv/build-book.py; python3 tests/vault/build.py --rv ;;
 *) echo 'Unknown target' >&2; exit 1 ;;
esac
