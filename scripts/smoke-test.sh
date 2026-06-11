#!/bin/bash
# One-shot smoke test: boots Harper, exercises the game API end to end.
set -u
B=https://localhost:9926
J='-H Content-Type:application/json -H Accept:application/json'
q() { curl -sk -m 5 $J "$@"; }

for i in $(seq 1 30); do curl -sk -m 1 $B/GameData/ -o /dev/null 2>/dev/null && echo "[boot ${i}s]" && break; sleep 1; done

echo "--- GameData biome count:"; q $B/GameData/ | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('biomes:',j.biomes.length,'animals:',j.animals.length,'recipes:',j.recipes.length,'objects:',j.habitatObjects.length,'tools:',j.tools.length,'appearanceOptions:',!!j.appearanceOptions)})"
echo "--- CreatePlayer Demo:"; q -X POST $B/CreatePlayer/ -d '{"name":"Demo","passcode":"1234","appearance":{"skin":"#eec39a","hair":"#6e4a33","outfit":"#4a7c59","hat":"straw"}}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log('playerId:',j.playerId,'placements:',j.state.placements.length,'chests:',j.state.chests.length,'passcode leaked:',JSON.stringify(j.state).includes('1234'))}catch(e){console.log(d.slice(0,200))}})"
echo "--- CreatePlayer duplicate (should fail):"; q -X POST $B/CreatePlayer/ -d '{"name":"Demo","passcode":"9999"}' | head -c 170; echo
echo "--- Login wrong passcode (should fail):"; q -X POST $B/LoginPlayer/ -d '{"name":"Demo","passcode":"wrong"}' | head -c 170; echo
echo "--- Login correct:"; q -X POST $B/LoginPlayer/ -d '{"name":"Demo","passcode":"1234"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log('playerId:',j.playerId,'appearance:',JSON.stringify(j.state.player.appearance))}catch(e){console.log(d.slice(0,200))}})"
echo "--- GameState unknown player (should fail):"; q $B/GameState/nobody-here | head -c 170; echo
echo "--- GameState demo:"; q $B/GameState/demo | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('player:',j.player.id,'inv:',JSON.stringify(j.player.inventory),'biomeStates:',j.biomeStates.length,'placements:',j.placements.length,'chests:',j.chests.length)})"
echo "--- Collect seeds:"; q -X POST $B/CollectResource/ -d '{"playerId":"demo","biomeId":"meadow","nodeId":"n0","resourceId":"seeds"}' | head -c 200; echo
echo "--- Collect again (should fail - regrowing):"; q -X POST $B/CollectResource/ -d '{"playerId":"demo","biomeId":"meadow","nodeId":"n0","resourceId":"seeds"}' | head -c 160; echo
echo "--- Collect from locked biome (should fail):"; q -X POST $B/CollectResource/ -d '{"playerId":"demo","biomeId":"wetland","nodeId":"n1","resourceId":"reeds"}' | head -c 160; echo
echo "--- Craft grass-patch (seeds+fiber from starter inventory):"; q -X POST $B/CraftItem/ -d '{"playerId":"demo","recipeId":"grass-patch"}' | head -c 260; echo
echo "--- Craft without materials (should fail):"; q -X POST $B/CraftItem/ -d '{"playerId":"demo","recipeId":"small-pond"}' | head -c 160; echo
echo "--- Deposit 2 branches into starter chest:"; q -X POST $B/ChestTransfer/ -d '{"playerId":"demo","chestId":"pl_demo_starter-chest","resourceId":"branches","qty":2,"direction":"deposit"}' | head -c 200; echo
echo "--- Craft bird-perch (3 branches: 2 now in chest, rest inventory => linked storage test):"; q -X POST $B/CraftItem/ -d '{"playerId":"demo","recipeId":"bird-perch"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log('ok:',j.ok,'usedFrom:',JSON.stringify(j.usedFrom))}catch(e){console.log(d.slice(0,200))}})"
echo "--- Place grass-patch in meadow:"; q -X POST $B/PlaceObject/ -d '{"playerId":"demo","objectId":"grass-patch","area":"meadow","x":10,"y":10}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log('ok:',j.ok,'health:',j.biomeState&&j.biomeState.health,'balance:',j.biomeState&&j.biomeState.balance,'newAnimals:',(j.newAnimals||[]).map(a=>a.animalId))}catch(e){console.log(d.slice(0,300))}})"
echo "--- Place bird-perch indoors (should fail - outdoor only):"; q -X POST $B/PlaceObject/ -d '{"playerId":"demo","objectId":"bird-perch","area":"home","x":3,"y":4}' | head -c 160; echo
echo "--- Place bird-perch in meadow:"; q -X POST $B/PlaceObject/ -d '{"playerId":"demo","objectId":"bird-perch","area":"meadow","x":12,"y":10}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log('ok:',j.ok,'health:',j.biomeState&&j.biomeState.health)}catch(e){console.log(d.slice(0,300))}})"
echo "--- Enter locked forest (should fail):"; q -X POST $B/SyncPlayer/ -d '{"playerId":"demo","x":5,"y":5,"area":"forest"}' | head -c 160; echo
echo "--- Upgrade field journal (should fail - meadow health too low? req 25):"; q -X POST $B/UpgradeTool/ -d '{"playerId":"demo","toolId":"field-journal"}' | head -c 220; echo
echo "--- Static index.html:"; curl -sk -m 4 $B/index.html | head -c 60; echo
echo "--- Static root /:"; curl -sk -m 4 $B/ | head -c 60; echo
echo "--- Reload GameState (persistence check):"; q $B/GameState/demo | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('placements:',j.placements.map(p=>p.objectId+'@'+p.area).join(','),'| meadow health:',j.biomeStates.find(b=>b.biomeId==='meadow').health)})"
echo "DONE"
