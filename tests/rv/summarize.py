"""Archive RV counts, runtime failures and source identities; fail closed."""
import sys,re,json
from pathlib import Path
log,hashes,out=map(Path,sys.argv[1:])
s=re.sub(r'\x1b\[[0-9;]*m','',log.read_text())
match=re.search(r'OK,.*?passed after (\d+) runs',s)
runtime=len(re.findall(r'\(runtime\)',s))
attempted=int(match[1]) if match else 0
passed=s.count('[PASS]')
result={'status':'passed' if match and not runtime else 'failed','attemptedRuns':attempted,'passedChecks':passed,'discardedRuns':attempted-passed if match else 0,
 'runtimeErrors':runtime,'sourceHashes':json.loads(hashes.read_text()),'log':str(log)}
out.with_suffix('.json').write_text(json.dumps(result,indent=2)+'\n')
start=s.find('EXECUTION STATISTICS')
out.with_suffix('.txt').write_text((json.dumps(result,indent=2)+'\n'+(s[start:] if start>=0 else s[-3000:])).rstrip()+'\n')
print(json.dumps(result))
if result['status']!='passed':sys.exit(1)
