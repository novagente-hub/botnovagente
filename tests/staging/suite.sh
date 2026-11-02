#!/bin/bash
# NovaBot staging computer-per-bot suite. Runs on the VPS. Prints PASS/FAIL per test.
B=http://127.0.0.1:13020/api/computers; H=(-H Origin:http://localhost:13020 -H Content-Type:application/json)
pass(){ echo "PASS | $1 | $2"; }; fail(){ echo "FAIL | $1 | $2"; }
nav(){ for i in 1 2 3 4 5 6 7 8 9 10; do o=$(curl -s -m 150 "${H[@]}" -X POST $B/$1/navigate -d "{\"url\":\"$2\"}"); [[ $o == *'"text"'* ]] && { echo "$o"; return; }; [[ $o == *snapshotRequired* ]] && curl -s "${H[@]}" -X POST $B/$1/snapshot -d '{}' >/dev/null; sleep 4; done; echo "$o"; }
cookies(){ nav $1 https://httpbin.org/cookies | python3 -c 'import sys,json
raw=sys.stdin.read()
try: print(json.loads(raw).get("text","").replace("\n"," ")[:200] or "RAW:"+raw[:250])
except Exception: print("RAW:"+raw[:250])'; }
C=novabot-staging-computer-bot-general-assistant
# T1 headful browser on Xvfb
m=$(docker logs $C 2>&1 | grep -m1 computer-browser-mode); x=$(docker exec $C sh -c 'pgrep -a Xvfb | head -1'); h=$(docker exec $C ps -eo args | grep '^/ms-playwright' | grep -c -- '--headless')
[[ $m == *headed* && -n $x && $h == 0 ]] && pass T1-headed "$m; Xvfb running; 0 headless chrome procs" || fail T1-headed "$m / $x / headless=$h"
# T2 persistence across docker restart
before=$(cookies general-assistant); docker restart $C >/dev/null; sleep 3; after=$(cookies general-assistant)
[[ $after == *nb_human* ]] && pass T2-persist-restart "before: $before | after docker restart: $after" || fail T2-persist-restart "$after"
# T3 persistence across stop + recreate via API (container removed, volume kept)
curl -s "${H[@]}" -X POST $B/general-assistant/computers/stop -d '{}' >/dev/null; sleep 5; st=$(docker ps -a --format '{{.Names}}' | grep -c "^$C$")
after2=$(cookies general-assistant)
[[ $after2 == *nb_human* ]] && pass T3-persist-recreate "container present after stop=$st; after re-ensure: $after2" || fail T3-persist-recreate "$after2"
# T4 isolation: second bot's browser does not see the cookie
k=$(cookies knowledge)
[[ $k != *nb_human* && -n $k ]] && pass T4-isolation-cookies "knowledge bot sees: $k" || fail T4-isolation-cookies "$k"
# T5 separate containers and volumes
v1=$(docker inspect $C --format '{{range .Mounts}}{{.Name}} {{end}}'); v2=$(docker inspect novabot-staging-computer-bot-knowledge --format '{{range .Mounts}}{{.Name}} {{end}}')
[[ $v1 != "$v2" && -n $v2 ]] && pass T5-own-volumes "GA: $v1 / knowledge: $v2" || fail T5-own-volumes "$v1 / $v2"
# T6 memory limit and loopback-only ports
for c in $C novabot-staging-computer-bot-knowledge; do mem=$(docker inspect $c --format '{{.HostConfig.Memory}}'); ports=$(docker port $c); use=$(docker stats --no-stream --format '{{.MemUsage}}' $c); echo "   $c mem=$mem ports=$ports use=$use"; done
ok=1; for c in $C novabot-staging-computer-bot-knowledge; do [[ $(docker inspect $c --format '{{.HostConfig.Memory}}') == 671088640 ]] || ok=0; docker port $c | grep -vq '127.0.0.1' && ok=0; done
[[ $ok == 1 ]] && pass T6-limits "640 MiB cap each, ports 127.0.0.1 only" || fail T6-limits see-above
# T7 staging cannot see production computers (namespace)
p=$(docker inspect novabot-computer-bot-general-assistant --format '{{index .Config.Labels "openbot.namespace"}}' 2>/dev/null); s=$(docker inspect $C --format '{{index .Config.Labels "openbot.namespace"}}')
[[ $s == novabot-staging && $p != novabot-staging ]] && pass T7-namespace "staging=$s prod=${p:-unlabelled(default)}" || fail T7-namespace "$s / $p"
# T8 agent tools via API: read, snapshot, screenshot, click
nav general-assistant https://example.com >/dev/null
r=$(curl -s "${H[@]}" $B/general-assistant/read | head -c 120); sn=$(curl -s "${H[@]}" -X POST $B/general-assistant/snapshot -d '{}')
sid=$(echo "$sn" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("snapshotId"))'); ref=$(echo "$sn" | python3 -c 'import sys,json;d=json.load(sys.stdin);print([e["ref"] for e in d.get("elements",[]) if "Learn" in str(e)][0])' 2>/dev/null)
cl=$(curl -s -m 60 "${H[@]}" -X POST $B/general-assistant/click -d "{\"ref\":\"$ref\",\"snapshotId\":$sid}" | head -c 160)
shot=$(curl -s "${H[@]}" $B/general-assistant/screenshot | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["width"],d["height"],len(d["base64"]),d.get("url"))')
u=$(curl -s "${H[@]}" $B/general-assistant/read | python3 -c 'import sys,json;print(json.load(sys.stdin).get("url"))')
[[ $u != https://example.com/ && -n $shot ]] && pass T8-tools "read ok; snapshot $sid ref=$ref; click -> $u; screenshot $shot" || fail T8-tools "$cl / $u / $shot"
# T9 production untouched
echo "   prod: $(docker ps --filter label=com.docker.compose.project=novabot --format '{{.Names}}:{{.Status}}' | tr '\n' ' ')"
pc=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:13010/health); [[ $pc == 200 ]] && pass T9-prod-healthy "prod /health=200" || fail T9-prod-healthy $pc
free -m | sed -n 2p
