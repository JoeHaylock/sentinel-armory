#!/bin/bash
# Verifier v1 — run from project root. Appends a timestamped record to verifier/runs/.
cd /mnt/agents/output/app
mkdir -p verifier/runs
TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG="verifier/runs/$TS.log"
{
  echo "# verifier v1 run @ $TS"
  echo "## npm run build"
  npm run build > /tmp/vbuild.log 2>&1
  echo "build exit=$?"
  tail -3 /tmp/vbuild.log

  echo "## dist entry"
  test -f dist/index.html && echo "PASS dist/index.html" || echo "FAIL dist/index.html"

  echo "## icons in dist"
  MISS=0
  for n in rifle sidearm plate helmet nvg radio medkit optic ruck crate; do
    if [ -f "dist/icons/$n.png" ]; then echo "PASS icon $n"; else echo "FAIL icon $n"; MISS=$((MISS+1)); fi
  done
  echo "missing=$MISS"

  echo "## feature strings present in bundle"
  JS=$(ls dist/assets/*.js | head -1)
  for s in AI_PASS DEPLOY_OUT RETRIEVE_IN REQ_CREATE "TURN ITEM" "AUTO_CYCLE"; do
    grep -q "$s" "$JS" && echo "PASS '$s'" || echo "FAIL '$s'"
  done

  echo "## factory-demo leftovers (expect none)"
  for s in "WO-" "CNC" "spindle" "FIELD REPORT" "Workshop 2"; do
    grep -q "$s" "$JS" && echo "FAIL leftover '$s'" || echo "PASS no '$s'"
  done

  FAILS=$(grep -c "^FAIL" "$LOG" 2>/dev/null || true)
} | tee "$LOG"
grep -q "^FAIL" "$LOG" && { echo "RESULT: FAIL"; exit 1; } || { echo "RESULT: PASS"; exit 0; }
