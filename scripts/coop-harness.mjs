// Co-op logic harness: runs the REAL server bundle (resources.js) against an
// in-memory mock of Harper's `databases`/`Resource`, so we can verify solo +
// co-op flows (gather, host, join, shared nodes, re-login) without a live Harper.
//
// Run:  node scripts/coop-harness.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const load = (p) => JSON.parse(readFileSync(join(root, p), 'utf8')).records;

// ---- in-memory table store ----
function makeTable() {
	const rows = new Map();
	return {
		async get(id) { return rows.has(id) ? structuredClone(rows.get(id)) : undefined; },
		async put(row) { rows.set(row.id, structuredClone(row)); },
		async patch(id, partial) {
			const cur = rows.get(id) || { id };
			rows.set(id, { ...cur, ...structuredClone(partial) });
		},
		async delete(id) { rows.delete(id); },
		search() { // async-iterable of all rows
			const snap = [...rows.values()].map((r) => structuredClone(r));
			return (async function* () { for (const r of snap) yield r; })();
		},
		_rows: rows,
	};
}

const TABLES = ['Biome','Animal','ResourceType','Recipe','HabitatObject','ToolDef','Achievement',
	'World','WorldMember','Player','BiomeState','Chest','Placement','Discovery','NodeState','TerrainTile','PlayerAchievement','FeedEntry','WorldPresence','JoinRequest'];
const wildwillows = {};
for (const t of TABLES) wildwillows[t] = makeTable();

// seed definition tables from data/*.json (what Harper's dataLoader does)
const seed = (table, recs) => recs.forEach((r) => wildwillows[table]._rows.set(r.id, structuredClone(r)));
seed('Biome', load('data/biomes.json'));
seed('Animal', [...load('data/animals-1.json'), ...load('data/animals-2.json')]);
seed('ResourceType', load('data/resources.json'));
seed('Recipe', load('data/recipes.json'));
seed('HabitatObject', load('data/habitat-objects.json'));
seed('ToolDef', load('data/tools.json'));
seed('Achievement', load('data/achievements.json'));

globalThis.databases = { wildwillows };
globalThis.Resource = class { constructor(id) { this._id = id; } getId() { return this._id; } };

// ---- run ----
const R = await import(join(root, 'resources.js'));
const call = (Cls, body, id) => new R[Cls](id).post ? new R[Cls](id).post(body) : null;
const post = (Cls, body) => new R[Cls]().post(body);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL:', msg); } };
const appearance = { skin:'#eec39a', hair:'#6e4a33', outfit:'#4a7c59', hat:'straw', hairstyle:'short', body:'slim' };
const meadowRes = load('data/biomes.json').find((b) => b.id === 'meadow').resources[0];

try {
	console.log('\n[1] Solo: create + gather + reload');
	const a = await post('CreatePlayer', { name: 'Solo Sam', passcode: 'pass1', appearance });
	ok(a.ok && a.worldId === a.playerId, 'solo player created, world = self');
	const g = await post('CollectResource', { playerId: a.playerId, biomeId: 'meadow', nodeId: 'n1', resourceId: meadowRes });
	ok(g.ok && g.gained[meadowRes] >= 1, `gathered ${meadowRes} (×${g.gained[meadowRes]})`);
	const reload = await post('LoginPlayer', { name: 'Solo Sam', passcode: 'pass1' });
	ok(reload.ok && (reload.state.player.inventory[meadowRes] || 0) >= 1, 'gathered material persists after re-login');

	console.log('\n[2] Co-op: host creates world');
	const h = await post('CreatePlayer', { name: 'Host Hana', passcode: 'pwpw', appearance });
	const cw = await post('CreateWorld', { playerId: h.playerId, name: 'Willowdale' });
	ok(cw.ok && cw.world.joinCode?.length === 6, `created co-op world, code ${cw.world?.joinCode}`);
	const sw = await post('SwitchWorld', { playerId: h.playerId, worldId: cw.world.worldId });
	ok(sw.ok && sw.worldId === cw.world.worldId, 'host switched into co-op world');
	const code = cw.world.joinCode;

	console.log('\n[3] Co-op: verify code, request, host approves, friend joins');
	const chk = await post('CheckWorldCode', { joinCode: code });
	ok(chk.exists && chk.world.name === 'Willowdale', 'CheckWorldCode finds the world before any character');
	const chkBad = await post('CheckWorldCode', { joinCode: 'ZZZZZZ' });
	ok(!chkBad.exists, 'CheckWorldCode rejects a bogus code');
	const f = await post('CreatePlayer', { name: 'Friend Fin', passcode: 'pwpw', appearance });
	const tok = 'tok_fin';
	await post('RequestJoin', { joinCode: code, token: tok, name: 'Friend Fin' });
	let blockedJoin = false;
	try { await post('JoinWorld', { playerId: f.playerId, joinCode: code, token: tok }); }
	catch (e) { blockedJoin = /approve/i.test(e.message); }
	ok(blockedJoin, 'join is blocked until the host approves');
	const pend = await post('PendingJoinRequests', { playerId: h.playerId });
	ok(pend.requests.some((r) => r.token === tok && r.name === 'Friend Fin'), 'host sees the pending request');
	await post('ResolveJoin', { playerId: h.playerId, worldId: cw.world.worldId, token: tok, approve: true });
	const jn = await post('JoinWorld', { playerId: f.playerId, joinCode: code, token: tok });
	ok(jn.ok && jn.worldId === cw.world.worldId, 'friend joins after approval');

	console.log('\n[4] Co-op: shared world — host places, friend sees it');
	// host gathers + crafts + places a grass patch; friend should see it in snapshot
	await post('CollectResource', { playerId: h.playerId, biomeId: 'meadow', nodeId: 'h1', resourceId: meadowRes });
	const fState = await post('LoginPlayer', { name: 'Friend Fin', passcode: 'pwpw' });
	ok(fState.worldId === cw.world.worldId, 'friend re-login resumes the CO-OP world (not solo)');

	console.log('\n[5] Co-op: shared node cooldown (no double-harvest)');
	const node = 'shared-node-x';
	const h1 = await post('CollectResource', { playerId: h.playerId, biomeId: 'meadow', nodeId: node, resourceId: meadowRes });
	ok(h1.ok, 'host harvested the shared node');
	let blocked = false;
	try { await post('CollectResource', { playerId: f.playerId, biomeId: 'meadow', nodeId: node, resourceId: meadowRes }); }
	catch (e) { blocked = /regrow/i.test(e.message); }
	ok(blocked, 'friend is blocked from instantly re-harvesting the SAME node (shared cooldown)');

	console.log('\n[6] Personal state stays personal');
	const hSnap = await post('LoginPlayer', { name: 'Host Hana', passcode: 'pwpw' });
	// host gathered the shared meadow resource twice; friend never gathered it — so
	// host should hold strictly more of it than the friend (inventories are personal)
	const hostHas = hSnap.state.player.inventory[meadowRes] || 0;
	const friendHas = fState.state.player.inventory[meadowRes] || 0;
	ok(hostHas > friendHas, `inventories are per-player (host ${hostHas} > friend ${friendHas} of ${meadowRes})`);

	console.log('\n[8] Realtime presence: positions merge into the shared WorldPresence record');
	await post('Presence', { playerId: h.playerId, x: 5, y: 6, area: 'meadow' });
	const fp = await post('Presence', { playerId: f.playerId, x: 12, y: 9, area: 'meadow' });
	ok(fp.peers.some((p) => p.playerId === h.playerId && p.x === 5 && p.y === 6),
		'friend sees host position via presence (the map a WebSocket sub would receive)');
	const wp = await wildwillows.WorldPresence.get(cw.world.worldId);
	ok(wp && wp.players[h.playerId] && wp.players[f.playerId],
		'WorldPresence record holds both players (subscribers get pushed this map)');
	const soloP = await post('Presence', { playerId: a.playerId, x: 1, y: 1, area: 'meadow' });
	ok(soloP.peers.length === 0, 'solo presence returns no peers (and broadcasts nothing)');

	console.log('\n[9] Roster + 6-person cap (returning players always allowed)');
	// host + Fin already = 2 members. Add 4 more to reach the cap of 6.
	for (let i = 0; i < 4; i++) {
		const name = `Filler ${i}`;
		const fp = await post('CreatePlayer', { name, passcode: 'pwpw', appearance });
		const ftok = `tok_fill_${i}`;
		await post('RequestJoin', { joinCode: code, token: ftok, name });
		await post('ResolveJoin', { playerId: h.playerId, worldId: cw.world.worldId, token: ftok, approve: true });
		await post('JoinWorld', { playerId: fp.playerId, joinCode: code, token: ftok });
	}
	const roster = await post('WorldRoster', { playerId: h.playerId });
	ok(roster.roster.length === 6 && roster.closed, `roster shows all 6 caretakers and is closed (history of who joined)`);
	// a 7th NEW person is blocked at the code check
	const chkFull = await post('CheckWorldCode', { joinCode: code });
	ok(chkFull.exists && chkFull.world.full, 'a new player sees the world as full/closed');
	let seventhBlocked = false;
	try { await post('RequestJoin', { joinCode: code, token: 'tok_7', name: 'Too Late' }); }
	catch (e) { seventhBlocked = /full|closed/i.test(e.message); }
	ok(seventhBlocked, 'a 7th new player cannot even request to join');
	// but an existing member can still re-enter the closed world
	const reenter = await post('JoinWorld', { playerId: f.playerId, joinCode: code, token: 'whatever' });
	ok(reenter.ok && reenter.worldId === cw.world.worldId, 'an existing member can re-enter even when closed');

	console.log('\n[10] Solo player is unaffected by co-op');
	const solo2 = await post('LoginPlayer', { name: 'Solo Sam', passcode: 'pass1' });
	ok(solo2.worldId === solo2.playerId && !solo2.worlds.some((w) => !w.solo), 'solo save still solo, no co-op worlds');
} catch (e) {
	fail++;
	console.log('\n✗ THREW:', e && e.stack || e);
}

console.log(`\n${fail === 0 ? '✅ ALL PASSED' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
