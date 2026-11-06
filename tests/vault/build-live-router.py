"""Final router integration: full deployed v5-5 router and v6-4 market.

Only dependency principals/asset names change. AMM and signed-feed fixtures
remain local and funded explicitly. No router business-logic replacements.
"""
from pathlib import Path
import sys,subprocess,json,hashlib
HERE=Path(__file__).resolve().parent
OUT=HERE/'.build-live-router'
subprocess.run([sys.executable,str(HERE/'build.py'),'--output',str(OUT)],check=True)
from jing_sources import checked_sources,market_fixture
sources,hashes=checked_sources()
s=sources['swap-router-sbtc-stx-jing-v5-5']
refs={
'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4':'v6-market',
'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token':'mock-ft',
'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2':'mock-ft',
'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx':'mock-ft',
'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-swap-router-v-1-2':'dlmm-router',
'SP1PFR4V08H1RAZXREBGFFQ59WB739XM8VVGTFSEA.dlmm-core-v-1-1':'dlmm-router',
'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2':'xyk',
'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1':'xyk',
'SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY.univ2-pool-v1_0_0-0070':'velar',
'SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY.univ2-fees-v1_0_0-0070':'velar'}
for i,n in [(1,'dlmm'),(2,'dlmm-2'),(3,'dlmm-3')]:refs[f'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-stx-sbtc-v-{i}-bps-15']=n
for a,b in refs.items():
 assert "'"+a in s,a
 s=s.replace("'"+a,'.'+b)
s=s.replace('"sbtc-token"','"mock-ft"')
(OUT/'contracts/mock-router.clar').write_text(s)
(OUT/'contracts/v6-market.clar').write_text(market_fixture(sources['markets-sbtc-stx-jing-v6-4']))
pool=(HERE/'fixtures/venues/pool.clar').read_text().replace('.asset-stx','.mock-ft').replace('.token','.mock-ft').replace('"token"','"mock-ft"')
# v5-5 reads the pool-status gate; the old venue fixture lacked that field.
pool=pool.replace('(ok {x-token:', '(ok {pool-status: true, x-token:')
for n in ['dlmm','dlmm-2','dlmm-3','xyk','velar']:(OUT/f'contracts/{n}.clar').write_text(pool)
(OUT/'contracts/dlmm-router.clar').write_text((HERE/'fixtures/venues/dlmm-router.clar').read_text())
man=(OUT/'Clarinet.toml').read_text()
for n in ['dlmm','dlmm-2','dlmm-3','xyk','velar','dlmm-router']:
 man+=f'\n[contracts.{n}]\npath="contracts/{n}.clar"\nclarity_version=6\nepoch="latest"\n'
(OUT/'Clarinet.toml').write_text(man)
(OUT/'router-substitutions.json').write_text(json.dumps(refs,indent=2)+'\n')
print('Built deployed-router integration',OUT)
