# Architecture

*Last updated: 2026-08-20*

Why Wild Willows is built the way it is.

This is the **why** document. `README.md` is what the game is; `CONTRIBUTING.md`
is how to run, test and ship it. This file records the decisions those two take
for granted — the ones that are currently spread across long file headers, the
`*Comment` keys in `package.json`, and PR descriptions that nobody will read
again. If you are about to change something here and it seems arbitrary, it
probably is not; each section says what breaks if you undo it.

---

## 1. Solo runs the server

`server/resources.ts` holds every rule in the game — inventory math, crafting
costs, placement legality, biome health, animal returns, unlock gating. The
frontend is never trusted with any of it. Solo play does not reimplement those
rules offline — it loads the same module and runs it against an in-memory
database.

`src/solo/backend.ts` installs shims for the two globals Harper provides
(`Resource`, `databases`) onto `globalThis`, imports the built server bundle,
and dispatches HTTP-shaped calls straight to the exported endpoint classes.
`src/solo/localDb.ts` is the in-memory database those endpoints write to.

What this buys:

- **One rulebook.** A balance change or a bug fix lands in one place and is true
  for hosted play, solo desktop play, and the browser demo at once.
- **Solo is offline.** No server, no network, no account.
- **Integration tests run the real server.** `tests/integration/` drives the
  built `resources.js` against an in-memory Harper mock, so the tests exercise
  the shipped artifact rather than an approximation of it.

What it costs:

- `server/` code has to stay runnable in a browser. No Node built-ins in the
  request path. Where one is unavoidable, `vite.config.ts` aliases it to a shim
  (`src/solo/cryptoShim.ts`, `src/solo/zlibShim.ts`).
- Module *initialization* order in `server/` is load-bearing. The layering is
  documented at the top of `server/resources.ts` and runs top-down; the few
  backwards references are all call-time, from inside a function body. A value
  read at module scope from a lower layer will break solo, where the whole graph
  is imported at once into one page.
- `resources.js` is committed, and three separate things consume that exact
  artifact. Rebuild it with `npm run build:server` whenever `server/` changes —
  see section 2.

## 2. How the app uses Harper

Harper is the database, the application server and the web server. The whole
hosted side of Wild Willows is one Harper component: no Express in front of it,
no static host beside it, no ORM under it. `databases.wildwillows` is not a
connection to something else — it is a handle on tables inside the same process
that is serving the request.

### What actually gets deployed

The component is four files and a directory, wired up by `config.yaml`:

```yaml
rest: true                                    # REST layer on
graphqlSchema: { files: 'schema.graphql' }    # table definitions
jsResource:    { files: 'resources.js' }      # the built server bundle
dataLoader:    { files: 'data/{...}.json' }   # seed rows for the definition tables
```

`resources.js` is `server/*.ts` bundled by esbuild (`npm run build:server`). It is
**committed**, because three separate things consume that exact artifact:
`deploy.sh` ships it, the desktop build packages it, and the integration tests
import it. Rebuild it whenever `server/` changes, or you are testing last
commit's server.

`dataLoader` enumerates the seed files with a brace glob rather than
`data/*.json`, because `data/weather.json` is not a seed file — it is build-time
config with no `database`/`table`/`records` shape, and the loader throws "missing
required table property" if it sweeps it up.

`deploy.sh` stages only `config.yaml`, `schema.graphql`, `resources.js`, `data/`
and a `package.json` with **no dependencies**, then deploys that temp directory.
Two reasons: `harper deploy` packages the whole
directory when you omit `package=` and it ignores `.gitignore`, so deploying from
the repo root uploads `node_modules` (~1.1 GB) and `dist/` (~431 MB) and wedges
the storage quota; and an empty dependency list stops the server trying to
`npm install` the desktop-only native module (`steamworks.js`).

It deploys with `restart=rolling replicated=true` and **without**
`ignore_replication_errors`. That flag was used once, and a replica that had
silently stopped replicating kept serving weeks-old code and data on `:443` while
the deploy reported success. A node that cannot take an update should fail the
deploy loudly. The script then verifies: `scripts/build-pages.mjs` bakes a unique
stamp into the bundle, `GET /Version/` serves it, and both public entry points
must answer with this build's stamp before the deploy is considered successful.

### Resources, not tables

**No table is `@export`-ed.** Harper can serve tables directly over REST; none of
these do. The public surface is exactly the names exported from
`server/resources.ts`, which is why that file is an export list and nothing else.
A table gets a route only when an endpoint is written for it.

Every endpoint is a class extending Harper's `Resource` with a `get()` and/or
`post()`. Authorization comes in three tiers:

- **`PublicEndpoint`** — `allowRead`/`allowCreate`/`allowUpdate` true,
  `allowDelete` false. The gameplay endpoints. There is no player auth yet (MVP
  scope), and the protection is structural instead: tables are not exported,
  every write is validated server-side, and Harper admin credentials never reach
  the frontend.
- **`DashboardEndpoint`** — `super_user` or a `metrics_reader` role, everything
  else denied. It **fails closed**: no user object, no access. It deliberately
  does not fall back to "allow if we cannot tell", which is the shape that turns
  an unrecognized user object into an open endpoint. `metrics_reader` exists so
  the credential the dashboard keeps in `sessionStorage` — it needs the password
  to authenticate its own requests — can read these numbers and do nothing else.
  A leaked super-user password would be full database access; this one is worth
  rotating and nothing worse.
- **Raw `Resource`** — `ListFeedback` (holds players' reply emails) and
  `SystemProbe` (reports server internals) carry more than gameplay numbers, so
  they stay on the bare class and need the real super-user key.

Harper still does the *authentication*; these only decide which authenticated
users get through. Note the version trap in the pinning section below: Harper 5.2
deprecates these hooks and they **fail open**.

The static site is endpoints too — the hosted Harper serves no static files at
all. The landing page, the policy and age-rating pages, support, teachers, the
dashboard, images, the classroom PDFs, `robots.txt` and `sitemap.xml` are all
`endpoints-pages.ts` classes, exported under the exact URL path they serve
(`PrivacyPage as privacy`, `RobotsTxt as 'robots.txt'`). The PDFs are exported
under both the bare name and the `.pdf` one, because the extension-stripping list
is Harper's, so the route resolves either way.

### Two kinds of table

`schema.graphql` holds two kinds of table, and they are encoded differently.

**Definition/seed tables** — `Biome`, `Animal`, `Recipe`, `HabitatObject`,
`ResourceType`, `ToolDef`, `Achievement` — have a fixed set of typed columns and
`@indexed` where it helps. They are seeded from `data/*.json` and never change
shape, so Harper's positional *structon* encoding is safe for them.

**Mutable game-state tables** — `Player`, `Placement`, `Discovery`, `BiomeState`,
`TerrainTile`, `NodeState`, `Chest`, `FeedEntry`, `PlayerAchievement`, and the
analytics rows — declare **only `id: ID @primaryKey`**. Every other field is
dynamic, so Harper stores the record as a flexible map.

That is why they are declared that way. Adding or removing a field on a
positional-encoded table left **old and new rows alike** undecodable — `Error
decoding record: Data read, but end of buffer not reached`. Dynamic rows do not
have that problem. The field shapes are still written down, in comments beside
each table: "dynamic" describes the storage, not the contract.

`SoloMetrics` is the deliberate exception. It is typed, because those columns need
to be searchable on Harper, and it stays safe by being **flat and all-scalar** —
the metrics view is stored as a JSON *string* in `snapshot`, never a nested map.
If its column set ever has to change, recreate the table rather than altering it.

### Scoping by primary key, because indexes are not available here

The mutable tables have **no secondary indexes, and must not gain any.** Three
reasons, any one of which would be enough:

1. An index needs a declared column, and declaring one moves the table back to
   positional encoding — straight into the undecodable-rows problem above.
2. Harper rejects a condition on an undeclared attribute outright, so a `worldId`
   filter is not something the server could push down even if it wanted to.
3. Secondary-index conditions proved unreliable across Harper versions and cold
   starts, returning **zero rows for a valid save** — which the game renders as
   an empty world. That makes this a correctness decision, not a performance
   one.

So scoping lives in the **primary key** (the KEY CONTRACT, currently `KEY_REV 3`).
World-owned rows are keyed `${worldId}:${...}`, every row of one world sorts into
a contiguous run, and a per-world read is a bounded `starts_with` range over
`primaryStore` — the same store and the same `getRange` a full scan already makes,
just with bounds. It cannot be colder or less ready than the unbounded scan it
replaces, and its cost tracks one world instead of the whole database.

This depends on one invariant: **no id may ever contain a colon.** Player ids are
`slugId(name)`, optionally plus `-${rand}`; world ids are `w_${ts36}_${rand}`. If
an id scheme ever admits a `:`, every per-world read silently starts returning
another save's rows, and `byWorld`'s explicit `worldId` filter is the only
remaining guard against cross-save corruption.

Older rows are re-keyed once per world by `migrateWorldKeys`, triggered from a
write path (login, first heartbeat). Until a world is marked migrated, reads merge
a legacy full scan so nothing ever reads empty. Migration is one-way, so a
positive answer is memoized in `keyedWorlds` — bounded at 20,000 entries with a
FIFO drop, because every entry is equally cheap to re-derive and an unbounded set
would grow with the player base for the life of the process.

`tests/integration/key-scoping.test.ts` and `read-amplification.test.ts` assert on
**row counts**, through the harness's scan stats, on a world big enough for the
difference to show. Read amplification regresses silently: nothing breaks and no
test fails, the game just gets more expensive the more of it a player has built.
A fresh save would not reveal it.

### Reads: Harper reports an unreadable record as `null`

Two facts about Harper drive all of `server/store.ts`.

1. **Harper does not throw on a decode failure.** `RecordEncoder.decode` catches
   the error, logs it, and returns `null`. From above, an unreadable row is
   indistinguishable from an absent one — and a null read on a `Player` or a world
   reads as "no such save", so callers respond by re-creating or overwriting live
   state.
2. **The error that actually appears is not data loss.** `Data read, but end of
   buffer not reached` is thrown by msgpackr *after* the value has decoded
   completely; it only reports that unread framing bytes remain. Harper discards
   an intact value because of trailing bytes.

So those records are recoverable, and the read path recovers them. `safeGet(table,
id)` reads normally; on a null it checks the raw bytes via
`primaryStore.getSync(id, { valueAsBuffer: true })` to tell absent from
unreadable, decodes leniently with msgpackr's `unpackMultiple` (the same code path
with the trailing-bytes assertion disabled), and **writes the value back**. The
rewrite re-encodes from scratch, so the next read goes through Harper's normal
path. Healing is lazy, on first touch. `existsRaw()` exposes the same raw-bytes
check directly, for anywhere a missing record would otherwise trigger a
create-or-overwrite.

Two guards sit on top of that. A salvage that would drop a field named in
`SALVAGE_REQUIRED` — `passcodeHash`, for instance — is **not** made permanent: a
save left broken is still recoverable by hand, whereas a save silently rewritten
without its credentials locks the player out for good. And when salvage gives up
entirely it writes a `SaveIncident` row, so unreadable saves show up on
`/dashboard` instead of existing only as a `console.error` nobody was tailing.

`findCounterRow` exists for the small read-modify-write analytics tables
(`LandingStat`, `AppOpen`). A primary-key `get()` can return null for a row that
genuinely exists on a cold instance. For a per-player read that is a retryable
miss; here it is destructive, because the caller reads null as "no row for today
yet", starts from zero, and `put`s over the whole day's accumulated counts. So a
null is the one answer never trusted: read by id first, and scan only to
disambiguate a null. It used to scan unconditionally, which meant every app-open
ping scanned every device ever seen — `AppOpen` is keyed `dev:<deviceId>`, one row
per install forever, not one row per day.

`forceRemove` is **not wired into any read path**, deliberately. On a `Player`
row it destroys the save outright, credentials
included, and the failures seen in production are recoverable framing bytes on
otherwise intact records. It exists for deliberate, operator-initiated cleanup of
a row that salvage has already declined.

### Writes: one player's row, one writer at a time

Every mutating endpoint is read-modify-write against the player row, so two
requests for the same player used to interleave: both read the same baseline, the
second patch landed on top of the first, and a double-click on a slow connection
passed both availability checks and crafted the item twice. `withPlayerLock`
serializes per player — a queue keyed by player id, not a global one, so unrelated
players never wait on each other, and the stored promise always resolves in a
`finally` so one failed request cannot wedge the queue behind it. `patchPlayer`
buffers inside the lock and writes through outside it, and `getPlayer` returns the
stored row merged with anything still pending, so a request always sees its own
writes.

### Compression, ETags and the edge

Harper's REST path does not compress resource responses, so the two large ones
compress themselves. Both share one contract: **with no HTTP request context they
return the plain object.** That is what lets the same code serve the solo backend
(where `node:zlib` is a no-op shim) and the integration harness.

Brotli quality is pinned to **5**. Node's default is 11, which on a 363 KB
snapshot costs over a second of CPU per request to save about 1 KB over q5
(measured: q5 → 10.5 KB / 3.0 ms, q11 → 9.3 KB / 1035 ms). Never call bare
`brotliCompressSync` on a request path.

`GameData` is identical for every client and changes only on deploy, so its ETag
is the build stamp and its compressed forms are cached. It answers `public,
max-age=0, must-revalidate, s-maxage=86400`: the browser's copy is stale on
arrival so a deploy shows up on the next load, while a shared cache may serve the
same body for a day. The second half is there because **a 304 is cheap in bytes
and not free in requests.** Something still has
to compare the ETag, and if that something is Harper, then a classroom behind one
address can put hundreds of requests a minute on the database however small the
bodies are. The rate limit protects the classroom from being blocked; the edge
cache is what protects Harper. It needs an explicit Cloudflare cache rule
(Cloudflare will not cache an extensionless JSON path on its own), and a deploy
must purge it (`npm run deploy:purge`) or the edge keeps serving the previous
build's body for up to a day. Section 3 covers the rate-limit tier that backs
this up when the cache is missed.

`GameState` is per-player, so nothing is cached — a cache here would be one whose
size tracks the player count. Its ETag is a 64-bit hash of the body, with
`serverTime` excluded because it changes on every call and no client reads it.
Everything else in the snapshot is a pure function of stored state, which is what
makes the tag safe **without a revision counter**: a counter can be forgotten on a
new write path, and a stale 304 would hand a player back a world missing the thing
they just built.

A 304 must carry an **explicitly empty body**. Harper's `finalizeResponse`
serializes the whole returned object into the response body when `body` is absent,
so leaving it undefined ships `{"status":304,…}` as the payload of a response
defined to have none.

`RollupCache` (in `store.ts`) fronts the dashboard and landing rollups, both of
which full-scan a table. It used to be invalidated by the very writes that make it
expensive — every app-open ping nulled the dashboard cache — so under any traffic
the TTL never fired and N reads after a write cost N full scans. Now a write only
sets a flag and bumps a version counter; rebuilding is lazy, readers arriving
during a scan join it, and the version counter is what makes joining safe. A
reader may only join a scan that started *after* the most recent write, so
read-your-own-write survives — a player's own uplink has to show on the dashboard.
A separate `retainMs` drops values nobody has read for a while, because the
dashboard rollup holds one parsed metrics snapshot per reporting save and is the
one cache here whose size tracks the player count.

### The same server code runs with no Harper at all

`server/resources.ts` only ever touches a small slice of Harper: the
`databases.wildwillows` handle, the `Resource` base
class, five table methods — `get`, `put`, `patch`, `delete`, `search` — and
`primaryStore` for the salvage path. That slice is small enough to reimplement,
and it has been, twice:

- **`src/solo/localDb.ts`** — the in-app backend. `src/solo/backend.ts` installs a
  `ResourceShim` and a `databases` object on `globalThis` *before* importing the
  bundle, because `class … extends Resource` runs at import time. One `LocalDb`
  instance is one solo save's world, and the definition tables are seeded from the
  same `data/*.json` the Harper data loader uses.
- **`tests/integration/harness.ts`** — the test double. It drives the built
  `resources.js` through Harper's own copy of `msgpackr`, so the record encoding
  the tests exercise is the encoding production uses. It also counts rows scanned,
  which is what makes the key-scoping assertions possible, and can mark a row
  undecodable to exercise the salvage path.

Both mirror Harper's query handling: `idPrefixOf`
recognizes a `starts_with` condition on the primary key as a range bound and
ignores anything else, which degrades to a full scan — slower, never wrong. The
salvage helpers in `store.ts` notice a missing `primaryStore` and become no-ops,
which is correct in solo, where there are no replicated records and so no
undecodable ones.

**That API slice is a contract with three implementations.** Using a Harper
feature the shims do not have — a secondary-index query, a transaction, a
subscription — breaks solo play and the integration suite along with it.

## 3. The public API, and keeping it from being abused

Two different audiences reach this server without credentials. The game clients
— desktop, the itch demo, the web build — call the gameplay endpoints. And
`/developers/api` publishes `GameData` as a free public dataset (150 species and
their food webs) with no API key at all. Both are deliberate, and both mean the
interesting security question here is not "who is allowed in" but "what can one
anonymous caller cost".

### What is public, and what is not

The boundary is an explicit list, written down in three places that have to
agree:

1. **The export map in `server/resources.ts`** — the only routes that exist at
   all. No table is `@export`-ed, so nothing is reachable by accident.
2. **The base class each endpoint extends** — `PublicEndpoint`,
   `DashboardEndpoint`, or raw `Resource` (see section 2).
3. **The `PROXIED` allowlist in `workers/play.js`** — which of those the demo's
   public hostname republishes.

The Worker list is an **explicit allowlist, never a prefix match and never a
denylist.** "Proxy everything except X" exposes each new endpoint the day it is
added, and nobody notices. Deliberately absent, and they must stay absent:
`DashboardAuth`, `MetricsSummary`, `MetricsPlayers`, `ServerHealth`,
`SystemProbe`, `ListFeedback`, `ClearProblem`, `GameplayHealth`, `SaveHealth`,
`LandingStats`. Those carry players' reply emails, real save ids and server
internals; they are reachable on Harper's own hostname behind its auth, which is
where they belong.

`tests/integration/endpoint-auth.test.ts` classifies **every** exported endpoint
against an explicit ADMIN/PUBLIC list and fails until a new one has been put on a
side in writing. Two things about how it checks matter:

- It asserts through **dispatch**, not by calling `allowRead(user)` and reading
  the return value. An endpoint whose hook correctly returns `false` is still
  wide open if nothing consults the hook, and a predicate test passes either way.
- It **cannot** prove Harper still calls the hooks. That is a property of the
  server, and it is what the 5.2 deprecation puts at risk: those hooks fail open,
  so the day they stop being consulted the dashboard feeds become readable and
  every test here stays green. That check has to run against a live instance.

### There is no login before you log in

`CreatePlayer`, `LoginPlayer`, `DeletePlayer`, `ChangePasscode`, `ExportDemoSave`
and `DeleteDemoSave` are open by necessity — the credential is the thing being
established. The passcode check lives **inside the handler**, not in the endpoint
being closed.

Passcodes are scrypt with a random 16-byte salt, compared with `timingSafeEqual`.
A save still on a legacy plaintext passcode is upgraded to a salted hash in place
on the first successful login, and the plaintext removed.

`scryptSync` is roughly 36 ms and **blocks the whole node**, which makes login the
most expensive thing an anonymous caller can trigger. Three caps bound it:

- `LOGIN_SCAN_CANDIDATE_MAX` (12) — how many same-name saves one attempt will
  hash against. Applies to both candidate sources, because capping only the
  cheap one achieved nothing.
- `LOGIN_HASH_BUDGET_MS` (500) — a wall-clock ceiling on hashing for one attempt.
  The count cap is a proxy; this bounds the thing that actually hurts, and it
  holds even if scrypt gets slower, the box is loaded, or the parameters change.
- `PLAYER_NAME_INDEX_MAX` (200) — how many ids one `PlayerNameIndex` row holds.
  The row is rewritten whole on every append, so an uncapped array is O(N²) write
  bytes to build and an unbounded read on every login for that name.

Past the candidate cap the oldest same-name saves are not reachable by name
login. That is the deliberate trade against letting one request own the event
loop.

Enumeration is handled by ordering rather than by messages: `DevTools` checks its
gate *after* `requirePlayer`, so an unknown id reads as a 404 instead of telling
a caller which ids exist.

### Rate limiting is at the origin

`server/rate-limit.ts` is the origin limiter. The Cloudflare Worker has its own
(below), but Harper's hostname is reachable directly, so an edge-only limit can
be routed around. Anything enforced at the origin holds regardless of how the
request arrived.

Tiers, in requests per minute, declared per endpoint as `static rateTier`:

| Tier | Rate | Applies to |
| --- | --- | --- |
| `action` | 600 | Ordinary gameplay writes (the default) |
| `read` | 300 | Reads that touch the database |
| `catalog` | 60 | `GameData` — see below |
| `telemetry` | 60 | `SyncMetrics`, `AppOpen`, `LandingEvent`, `LessonEvent` |
| `dev` | 60 | `DevTools` |
| `report` | 20 | Endpoints that write a permanent row for an anonymous caller |
| `auth` | 10 | Every path that runs scrypt |

600/min for gameplay is deliberately generous: a busy player lands maybe 60
actions a minute and heartbeats twice, so an order of magnitude of headroom means
nobody legitimate ever sees a 429. The strict tiers are the ones where a single
request is expensive or permanent.

**Two buckets per request, and the second is the one that survives a liar.** A
per-caller bucket is only as good as the caller's identity, and here that identity
is a header (`cf-connecting-ip`, set by Cloudflare and unforgeable *through* the
Worker). Someone who skips the Worker and hits Harper directly can put whatever
they like in it, and a fresh forged address every request means a fresh full
bucket every request. There is no fix for that without a shared secret between
edge and origin, which this deployment does not have. So the per-caller bucket
does the precise job — one bad actor cannot spoil it for everyone — and a
service-wide bucket per tier sits behind it at 200x, sized so real aggregate
traffic never approaches it. A request only spends from either bucket once both
have room, so a caller being turned away by one limit does not quietly drain the
other.

A caller with no usable address header shares one bucket per tier at 50x, so a
header-shape surprise in production cannot 429 every player at once while still
leaving a ceiling.

Smaller details that each fix a real failure:

- **Continuous refill, not fixed windows.** A window lets a caller spend a full
  budget at the end of one and the whole of the next immediately after — twice
  the intended rate at the worst moment.
- **The bucket map is attacker-keyed**, so it is capped at 20,000 with a sweep
  every minute for buckets idle long enough to have refilled completely
  (forgetting one of those is free — a full bucket and no bucket behave
  identically). At the ceiling the oldest entry is dropped rather than the request
  refused: running out of bookkeeping space must not become a way to get a 429.
- **Charged once per request**, not once per call. Four endpoints take the player
  lock in `post` and hand off to a private method, and both halves call `bodyOf` —
  which charged those requests twice and silently halved their budget.
- **Charged inside `bodyOf`**, which every POST handler goes through, so no
  endpoint can be added later that quietly misses it. The few GETs that touch the
  database charge explicitly.
- **Not applied to the in-app solo backend.** `getContext()` returning nothing is
  the established signal for "no HTTP request". Solo is one player driving their
  own process, so there is nothing to limit.

### The catalog tier is sized against the cache, not against the classroom

`GameData` gets its own tier because the number that matters is what the *origin*
sees, and that stopped being what a classroom sends.

The old value was 600/min, and it was classroom arithmetic. The lesson editor
runs student code in a `sandbox="allow-scripts"` frame on an opaque origin, so it
shares no HTTP cache and never sends `If-None-Match` — measured, thirty edits
produced thirty full responses and zero 304s — and thirty students at twenty runs
a minute is 600 from one NAT.

With the Cloudflare rule on `/GameData*` the edge answers the repeats, so the
origin sees roughly one request per edge location per day plus a burst when the
cache is cold or has just been purged. The question the tier answers changed from
"how much does a classroom send" to "how much can miss the cache":

- **Legitimate worst case:** ~30 requests in a second or two (cold edge, a class
  presses Run together), then nothing for the rest of the day.
- **Abusive worst case:** `/GameData?x=<random>` busts the cache on every request,
  so the entire budget lands at the origin. At 600/min that was about 72 MB a
  minute — 4.3 GB an hour — from one address, entirely inside the published
  limit.

So the tier is 60/min, and **burst equals the minute on purpose.** Everything
honest here is a spike; nothing honest is a grind. A bucket that holds a full
minute and refills at one a second allows the spike and refuses the sustained
pull. The edge cache-key rule that ignores the query string is what stops
`?x=<random>` from reaching Harper at all — the rate limit is the backstop for
when it does.

### A body size cap, and what it does not do

`MAX_BODY_BYTES` is 128 KB, measured as re-serialized JSON, and comfortably above
every legitimate body: the largest are `AppendFeed` (`FEED_CAP` 100 lines × 500
chars, ~50 KB) and `SyncMetrics` (`METRICS_SNAPSHOT_MAX_BYTES` 24 KB plus its
scalars).

Be clear about what it bounds. Harper has already parsed the request by the time
a handler runs, so this cannot protect against the parse — that cost is sunk.
What it stops is the durable half: a body that size being **persisted, iterated
key by key, or copied into a cached rollup**, which is where an oversized request
turns from one slow moment into a permanent one. A body that cannot be serialized
at all (circular) is refused with the same 413, because it cannot be stored
either.

### Anonymous writes are allowlisted, not sanitized

The telemetry endpoints mint permanent rows from client-supplied keys, which is
the sharpest thing an anonymous caller can do here. Three defenses, in order of
how much they carry:

**The `report` tier (20/min)** covers everything that writes a permanent row for
an anonymous caller: `SubmitFeedback`, `ReportSaveIncident`, `ReportClientError`.

**A closed key allowlist** covers `LessonEvent`. `LESSON_KEYS` names every key
that may be stored; anything else is dropped, so adding a metric means naming it
in the open. That is what enforces a promise made in `PRIVACY.md` and printed on
the pages themselves: aggregate counters only — no identifiers, no class codes, no
free text, no timings, and nothing a student typed. The moment one of those
appears in that table it stops being an anonymous counter and becomes an education
record, with FERPA, district review and data-subject requests attached, for a free
lesson page.

**Truncation at the boundary.** Every client-supplied string that reaches a row is
`.slice()`d to a fixed length where it enters — the row is permanent, so the cap
has to be applied before the write, not trusted to the caller.

Two structural limits sit under all of that. `PublicEndpoint` sets
`allowDelete` to **false**, so deletion is never a REST verb — it is a handler
decision behind a passcode. And `DevTools`, which is public and proxied because
the demo needs it, refuses any save whose name does not `slugId`-normalize to
exactly `bailey-test` — checked before the action switch, so no action can write
to a save that is not a test save, and matched exactly rather than by prefix.

### The edge is a first line, not the boundary

`workers/play.js` runs an edge rate limiter at 300/min with a 120 burst, and it is
**best effort by construction**: the state lives in one isolate, Cloudflare runs
many across many locations and recycles them freely, so an attacker spread across
colos sees a much higher effective limit than those numbers suggest. It is there
because it is nearly free and it absorbs the common case — one script hammering
one endpoint from one place — before any of it reaches Harper.

The Worker forwards a **minimal header set** (`content-type`, `accept`,
`accept-encoding`, `accept-language`, `if-none-match`) plus `cf-connecting-ip`.
Cookies and client hints have no business reaching Harper. `cf-connecting-ip` on
the inbound request is set by Cloudflare and cannot be spoofed by the browser, so
what is forwarded is trustworthy — what the origin cannot know is whether a
request came through the Worker at all, which is why the service-wide ceiling
exists.

On an upstream failure the Worker returns a **502, not a synthesized success.**
Gameplay reads the status: the client shows "the server can't be reached" and
keeps the player's session, whereas a fake 200 with no body would surface as
corrupt state.

Nothing at the edge should ever be the only thing standing in front of an
endpoint.

## 4. Where state lives

There are three players' worth of state in this project and they have very
different durability requirements.

| State | Where it lives | Durability contract |
| --- | --- | --- |
| Hosted play | Harper tables (`schema.graphql`) | The server's problem. Backed up by the cluster. |
| Solo, desktop | JSON files in `userData/saves/` | **Only copy in existence.** See below. |
| Solo, browser | IndexedDB, `wild-willows` / `IndexedSoloSave` | Best-effort; a browser can evict it. |
| Preferences | `localStorage` | Disposable. Losing it costs a settings re-tick. |

### Solo desktop saves are the highest-value state in the project

A solo save is many hours of authored progress, it exists in exactly one place,
and there is no server copy to restore from. Everything about how it is written
follows from that.

`electron/saves.js` writes to a temp file, `fsync`s it, rotates the previous
save to `.bak`, and `rename`s the temp into place. `rename(2)` is atomic within
a filesystem, so a reader sees a whole save or the previous whole save — never a
prefix. The header of that file walks through each crash window and what
survives it; read that before changing the write path.

The rule this replaced was `fs.writeFileSync(slot, contents)`, which opens the
real save with `O_TRUNC` and then streams megabytes into it. Between the
truncate and the last byte, the player's save on disk is a prefix of the new
one. Autosave fires after actions, so that window was entered constantly.

Reads walk `<slot>.json` → `.tmp` → `.bak` and take the first candidate that
parses as JSON. Primary is tried first on purpose: a leftover `.tmp` next to a
valid primary is an *uncommitted* write, and honoring it would resurrect a save
the write path never promised. When a fallback does win, the slot is healed
immediately — without that, the next write would rotate the corrupt primary over
the only intact copy.

A recovery is reported: main → `saves:recovered` → `watchDesktopSaveRecovery()`
→ `ReportSaveIncident`. Solo's backend is local, so the `SaveIncident` row the
server writes on a decode failure lands in the *player's own* database and never
reaches the hosted instance. Without this uplink, desktop save corruption is
unobservable.

### Browser solo saves are IndexedDB, not localStorage

`localStorage` is synchronous — every autosave blocked the main thread mid-play
— and capped near 5 MB per origin, which several engines halve again by storing
strings as UTF-16. A long save is megabytes of JSON, so players were hitting
`QuotaExceededError` mid-session and losing every save from that point on.

IndexedDB fixes both and is absent in some environments (private browsing,
sandboxed frames, the unit-test env), so every operation degrades to the old
`localStorage` behavior rather than failing. `indexedSoloSaves() === null` is a
supported state, not an error path.

The one exception is unload. IndexedDB has no synchronous API and an unload
handler cannot wait, so the last write on the way out goes to `localStorage`
under `wild-willows:solo-save-pending:` and the next load folds it in and
deletes it. One save, for the seconds between closing and reopening.

`SOLO_SAVE_DB` and `SOLO_SAVE_STORE` are **persisted schema**. Renaming either
after players have migrated does not move their saves, it hides them.

## 5. The desktop shell

`electron/` is a shell around the bundled web build and nothing more. It loads
`web/index.html` from disk over `file://`. It has no in-app browsing, no OAuth
popup, no embedded storefront, and it does not talk to a server to play.

Because of that, **any navigation away from `file://` is by definition something
going wrong** — an injected `<a target>`, a compromised third-party asset, a
crafted save that smuggles markup into the DOM. `hardenContents()` in
`electron/main.js` denies it: `will-navigate` and `will-redirect` are restricted
to internal protocols, `setWindowOpenHandler` denies by default and sends only
`http(s)` to the system browser, `<webview>` attachment is refused outright, and
every gated permission (camera, mic, geolocation, notifications, clipboard) is
declined without prompting, because the game needs none of them.

`contextIsolation: true` and `nodeIntegration: false` were already the barrier
between a hostile page and Node. The navigation lockdown means a remote origin
cannot be reached in the first place, so that barrier is not the only thing
standing there. It is applied through
`app.on('web-contents-created')` rather than to the main window alone, so it
covers anything created later.

`preload.js` is the entire surface between the renderer and the OS: a channel
flag, the save-slot IPC, and the Steam metrics push. Adding to it is adding
attack surface — the bar is that the renderer genuinely cannot do the thing
itself. `process.mas` is the current example: it is invisible from the renderer,
so the storefront verdict has to be made in the preload and handed across.

Two platform quirks worth knowing about:

- **The single-instance lock is skipped on Mac App Store builds.** The App
  Sandbox blocks Electron's singleton from `bind()`ing its socket in `$TMPDIR`,
  so `requestSingleInstanceLock()` returns false and every store download would
  quit silently on launch. Launch Services already prevents a second copy of a
  sandboxed store app. `scripts/check-mas-singleton.mjs` guards this.
- **`steamworks.js` is excluded from the MAS build.** Steam cannot run inside
  the sandbox, and `electron/steam.js` already no-ops when the module is
  missing.

## 6. Dependencies that are pinned, and why

**`harper` is pinned exactly — no caret.** It must equal the version the hosted
cluster runs (currently `5.1.26`). It is a devDependency, but not a normal one:
`tests/integration/harness.ts` drives the real built `resources.js` through
Harper's own `msgpackr`, so the record encoding these tests exercise has to be
the encoding production uses, and `harper dev .` is only a useful local server
if it behaves like the deployed one.

A caret broke exactly that once. `^5.1.15` resolved to `5.2.2`, so local dev and
CI were testing against a Harper the cluster does not run — and 5.2 deprecates
`allowRead`/`allowUpdate`/`allowCreate`/`allowDelete`, which *is* the
authorization model in `server/resources.ts`. The deprecated hooks **fail open**,
and `tests/integration/metrics-split.test.ts` asserts on `allowRead()` directly
rather than through dispatch — so the suite would have stayed green while the
dashboard endpoints quietly stopped being protected. Raise the pin when the
cluster is upgraded, not before, and read the 5.2 notes first.

**`harper` is not a production dependency.** v1 ships solo-only on itch.io, and
solo needs no server. Keeping Harper out of `dependencies` stops
electron-builder bundling its heavy native tree into every platform's app, which
also de-risks the cross-platform CI builds. `steamworks.js` is the only runtime
dependency electron-builder has to package.

**`oxlint-tsgolint` is version-coupled to TypeScript.** `7.0.2001` wraps
`typescript@7.0.2`. Bump it *with* `typescript`, not independently.

## 7. Testing strategy

Four suites, deliberately separated by what they can prove:

- **unit** (`tests/unit/`, jsdom) — pure logic and browser-ish helpers.
- **integration** (`tests/integration/`, node) — the **real built
  `resources.js`** against an in-memory Harper mock. This is where server
  behavior is actually pinned down. Run `npm run build:server` first; a stale
  bundle means you are testing the last commit.
- **e2e solo** (`tests/e2e/`, Playwright) — offline solo against the static web
  build. This is what proves the whole stack boots.
- **e2e website / classroom** — separate configs, separate targets.

`vitest.config.ts` is intentionally **not** `vite.config.ts`. The app build
aliases `node:crypto` to a browser shim; tests run on Node and must use the real
one for passcode hashing and salts. Do not merge them.

### Coverage is a floor, not a target

`vitest.config.ts` sets `coverage.thresholds` a little under where the suite
actually sits. When the floor was added the measured numbers over that
include/exclude set were **lines 37.7%, statements 35.7%, functions 34.8%,
branches 27.9%** across 1,807 tests, and the floor was set at 35 / 33 / 32 / 25.

The purpose is to catch **erosion** — a refactor that quietly drops a tested
module, a new subsystem that arrives with no tests at all — not to chase a
number. Chasing the number produces tests written to touch lines.

The thresholds are only evaluated when vitest runs with `--coverage`, which is
why the CI step passes that flag. Without it the job passes on a suite that has
quietly stopped covering half the code.

When coverage rises and holds, raise the floor to just under the new level. Do
not lower it to make a red build green; that is the one move the floor exists to
prevent. If a change legitimately reduces measured coverage — deleting
well-tested code, say — lower it deliberately, in its own commit, with the
reason in the message.

The Phaser-bound game modules are excluded because they cannot be instantiated
without a WebGL context. The two modules that hold the game's *rules*
(`worldRules.ts`, `interactions.ts`) are pure and are deliberately counted.

## 8. Tooling: what checks what

| Command | Answers |
| --- | --- |
| `npm run check` | Does it typecheck, and is the i18n catalog complete? |
| `npm run lint` | Semantic lint (oxlint), then formatting (Prettier). |
| `npm test` | Unit + integration. |
| `npm run test:e2e:solo` | Does the shipped build boot and play? |

### The lint config starts warn-heavy on purpose

The semantic linter is oxlint (`.oxlintrc.json`); the header of that file records
why. It runs `correctness`, `suspicious` and `perf` at **warn**, which does not
fail the command — 513 warnings at the time it landed. A small set of rules with
**zero hits when they were added** are set to `error`, so they gate new code
without requiring a cleanup first.

That is the ratchet: when a rule's warning count reaches zero, promote it to
`error`. Rules turned `off` fall in two groups and the config labels which is
which — ones that do not apply to this stack (each verified by reading the
actual hits, not assumed), and ones that are deliberate style here.

## 9. Decision log

| Decision | Because | Revisit when |
| --- | --- | --- |
| Server logic runs in-app for solo | One rulebook for hosted, desktop and demo; solo works fully offline | Never, without a very good reason |
| Desktop saves are atomic files with a `.bak` | Only copy of the player's progress; a truncated save is unrecoverable | — |
| Browser solo saves in IndexedDB | `localStorage` is synchronous and quota-capped below a real save's size | — |
| `file://`-only navigation in Electron | The shell has no legitimate reason to reach a remote origin | The app gains real in-app browsing |
| Tables are never `@export`-ed | The REST surface should be the endpoint list, not the schema | — |
| Mutable tables declare only `id` | A field change on a positional-encoded table left old *and* new rows undecodable | — |
| Per-world scoping lives in the primary key | Secondary indexes need a declared column, and index conditions returned zero rows for good saves | Harper's index behavior is provably stable |
| Reads salvage rather than delete | Harper reports an unreadable row as `null`, and the errors seen are recoverable framing bytes | — |
| Endpoints compress themselves at brotli q5 | Harper's REST path does not compress; q11 costs a second of CPU to save 1 KB | — |
| Worker proxy list is an allowlist | A denylist publishes each new endpoint the day it is added | — |
| Per-caller *and* service-wide rate buckets | The caller's address is a header, forgeable by anything skipping the Worker | There is a shared secret between edge and origin |
| `GameData` capped at 60/min | Sized against what can miss the edge cache, not what a classroom sends | The edge cache rules change |
| Anonymous telemetry keys are allowlisted | A permanent row from a client-supplied key is the sharpest anonymous action | — |
| `harper` pinned exactly | Tests must exercise the encoding and auth model production runs | The cluster is upgraded |
| `harper` is dev-only | Solo needs no server; keeps native trees out of every packaged app | Hosted play ships in the desktop build |
| Coverage floor, not target | Protects against erosion without rewarding tests-for-lines | — |
