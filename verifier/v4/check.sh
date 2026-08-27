#!/bin/bash
# Verifier v4 — run from project root. Appends a timestamped record to verifier/runs/.
cd /mnt/agents/output/app
mkdir -p verifier/runs
TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG="verifier/runs/$TS.log"
{
  echo "# verifier v4 run @ $TS"
  echo "## build + dist assembly (mount-flaky workaround: build to /tmp, verified copies)"
  rm -rf /tmp/distbuild
  npx vite build --outDir /tmp/distbuild > /tmp/vbuild.log 2>&1
  echo "build exit=$?"
  tail -2 /tmp/vbuild.log
  python3 - <<'PYEOF'
import os, re, shutil, time, sys
SRC='/tmp/distbuild'; DST='/mnt/agents/output/app/dist'
def cp(s,d,t=30):
    for i in range(t):
        try:
            os.makedirs(os.path.dirname(d),exist_ok=True); shutil.copyfile(s,d)
            if os.path.exists(d) and os.path.getsize(d)==os.path.getsize(s): return True
        except OSError: time.sleep(0.3)
    return False
ok=True
for root,_,files in os.walk(SRC):
    for f in files:
        s=os.path.join(root,f); rel=os.path.relpath(s,SRC)
        if not cp(s,os.path.join(DST,rel)): print('FAIL copy',rel); ok=False
idx=open(os.path.join(DST,'index.html')).read()
refs=set(re.findall(r'assets/[^"\']+',idx))
for f in os.listdir(os.path.join(DST,'assets')):
    if 'assets/'+f not in refs: os.remove(os.path.join(DST,'assets',f))
print('assembly OK' if ok else 'assembly ERR')
sys.exit(0 if ok else 1)
PYEOF
  echo "assembly exit=$?"
  echo "assets: $(ls dist/assets | wc -l) files, icons: $(ls dist/icons | wc -l) files"

  echo "## dist entry"
  test -f dist/index.html && echo "PASS dist/index.html" || echo "FAIL dist/index.html"

  echo "## icons in dist"
  for n in rifle sidearm plate helmet nvg radio medkit optic ruck crate shirt smock boots photo-rifle photo-clothing photo-kit; do
    [ -f "dist/icons/$n.png" ] && echo "PASS icon $n" || echo "FAIL icon $n"
  done

  echo "## v4 feature strings in bundle"
  JS=$(ls dist/assets/*.js | head -1)
  for s in "ISS-501" "ISSUE RECORD" "REVIEW" "Flagged" "Tear / hole" "AI_FLAG" "WO_RAISE" "Return to rack" "Override" "Raise repair work order" "ISSUE HISTORY"; do
    grep -q "$s" "$JS" && echo "PASS '$s'" || echo "FAIL '$s'"
  done

  echo "## v3 feature strings still present"
  for s in AI_PASS DEPLOY_OUT RETRIEVE_IN "AUTO_CYCLE" "Stock catalog" "sentinel-armory-v1" "L85A3" "CAM 03"; do
    grep -q "$s" "$JS" && echo "PASS '$s'" || echo "FAIL '$s'"
  done

  echo "## factory-demo leftovers (expect none)"
  for s in "CNC" "spindle" "FIELD REPORT" "Workshop 2"; do
    grep -q "$s" "$JS" && echo "FAIL leftover '$s'" || echo "PASS no '$s'"
  done
} | tee "$LOG"
grep -q "^FAIL" "$LOG" && { echo "RESULT: FAIL" | tee -a "$LOG"; exit 1; } || { echo "RESULT: PASS" | tee -a "$LOG"; exit 0; }
