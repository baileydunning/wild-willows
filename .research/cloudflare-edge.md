# Edge rules for `/GameData` — the belt to the origin's braces

Cloudflare dashboard configuration, recorded here because the origin's numbers
assume it. `catalog: { perMinute: 60, burst: 60 }` in `server/resources.ts` is the
braces; this is the belt, and it works on traffic that never reaches Harper.

**Read the gotcha first, because it inverts the obvious design.**

## The gotcha: rate limiting counts cache hits, unless the plan says otherwise

Cloudflare's rate limiting rules count **every** request by default, cache hits
included. The setting that changes that — *Also apply rate limiting to cached
assets*, off, or `requests_to_origin: true` in the API — is **Business and
Enterprise only**.

That matters more here than anywhere else on the zone, because the one thing that
looks like abuse and is not is a classroom: thirty students pressing Run twenty
times a minute is **600 requests a minute from one school address**, and today
every one of them is a cache hit that costs nothing. An edge rule set to 60/min
would block that class while the origin sat idle.

| Plan | What to do |
|---|---|
| **Free / Pro** | The rule counts cache hits. Use it as a **flood ceiling** (1,200/min) and do the precise work with Custom Rules, which are free, more numerous and deterministic. |
| **Business+** | Turn *Also apply rate limiting to cached assets* **off** and set **60/min**, mirroring the origin exactly. A classroom becomes invisible to it. |

Plan limits: rate limiting rules — Free **1**, Pro 2, Business 5. Custom rules —
Free **5**, Pro 20. Counting characteristic on Free/Pro is **IP only**, and the
longest counting period is **1 minute**.

## Rule 0 — Ignore the query string in the cache key (do this one first)

Highest value on the page, available on every plan, costs nothing.

**Caching → Cache Rules → Create rule**

- Expression: `starts_with(http.request.uri.path, "/GameData")`
- Cache eligibility: **Eligible for cache**
- Edge TTL: **Use cache-control header**  ·  Browser TTL: **10 minutes**
- **Cache Key → Query String → Ignore all query string parameters**

`GET /GameData?x=91723` is a different URL and therefore a different cache object:
a miss, and an origin fetch. That is the entire cache-busting attack and it is one
loop in a browser console. The endpoint reads no parameters, so every query string
on it is a mistake or an attack, and folding them onto one key makes both
harmless. Afterwards `?x=<random>` is a **HIT**.

Accept knowingly: a developer using `?v=2` to force a fresh copy gets the cached
one. Correct trade — deploys purge the edge, so nobody needs a manual buster.

## Rule 1 — Only GET and HEAD (Custom Rule, free)

```
starts_with(http.request.uri.path, "/GameData")
and not http.request.method in {"GET" "HEAD"}
```
Action: **Block**. The origin already refuses these; this refuses them a few miles
from the sender, and makes the docs literally true at the edge.

## Rule 2 — Challenge the cache-busters (Custom Rule, free)

```
starts_with(http.request.uri.path, "/GameData")
and len(http.request.uri.query) > 0
```
Action: **Managed Challenge**. With Rule 0 these are already hits, so this is
belt-and-braces — but it stops a script *discovering* that. A browser passes
invisibly; a loop in `curl` does not. Use **Log** instead for a fortnight first if
challenging an API feels unfriendly.

## Rule 3 — The rate limiting rule (one of these on Free)

**Security → WAF → Rate limiting rules**

- If: `starts_with(http.request.uri.path, "/GameData")`
- Characteristics: **IP** · Period: **1 minute**
- Requests: **1,200** on Free/Pro · **60** on Business+ with cache exclusion on
- Action: **Managed Challenge**, not Block. A blocked classroom is a support
  email; a challenged one is a blink for the student and a wall for a script.

1,200 is twice the full-classroom figure. It is not a precision instrument — it
cannot be while it counts cache hits — and it is not meant to be. The origin's
60/min does the precise work on whatever gets through the cache.

## Optional, in rough order of value

- **Tiered Cache (Standard)** — *Caching → Tiered Cache*, free. Lower tiers ask an
  upper-tier data center instead of the origin, so a cold cache costs one origin
  fetch per region rather than one per data center.
- **Close the back door.** All of the above is bypassed by talking to the Harper
  hostname directly, which is also how a forged `cf-connecting-ip` gets a fresh
  bucket per request — the hole `rateLimit()` already documents. The fix is
  **Authenticated Origin Pulls**, or an allowlist of Cloudflare IP ranges at the
  origin. Careful: `workers/play.js` proxies the demo straight to that hostname,
  so test the browser demo immediately after.
- **Bot Fight Mode** — free, catches naive scripted pulls, and also challenges
  some legitimate API clients. For a documented public API I would leave it off
  and let Rules 0–3 do the work.

## Verifying it

```bash
# 1. A normal read is a HIT after the first one.
curl -sI https://wildwillows.app/GameData | grep -i 'cf-cache-status\|cache-control\|age'

# 2. Rule 0 working: a cache-busting query is ALSO a hit.
curl -sI 'https://wildwillows.app/GameData?x=91723' | grep -i cf-cache-status
#    Expect HIT. Before Rule 0 this is MISS every single time.

# 3. Rule 1 working: a write is refused at the edge.
curl -sI -X POST https://wildwillows.app/GameData | head -1

# 4. The origin's own limit, visible only by skipping the cache.
for i in $(seq 1 80); do
  curl -s -o /dev/null -w '%{http_code} ' https://wild.willows.harperfabric.com/GameData
done; echo
#    Expect 200s, then 429s once the 60-token bucket is spent.
```

Then the one that matters: **open the lesson, press Run, and confirm a student
still gets data.** The itch demo fetches this path from the apex *with* a trailing
slash, which is why every expression above uses `starts_with` rather than an exact
path — it has to match both spellings.

## Terraform

```hcl
resource "cloudflare_ruleset" "gamedata_cache" {
  zone_id = var.zone_id
  name    = "GameData cache key"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  rules {
    action      = "set_cache_settings"
    expression  = "starts_with(http.request.uri.path, \"/GameData\")"
    description = "Query string is not part of the identity"
    action_parameters {
      cache = true
      cache_key { custom_key { query_string { exclude = ["*"] } } }
      edge_ttl    { mode = "respect_origin" }
      browser_ttl { mode = "override_origin", default = 600 }
    }
  }
}

resource "cloudflare_ruleset" "gamedata_waf" {
  zone_id = var.zone_id
  name    = "GameData custom rules"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules {
    action      = "block"
    expression  = "starts_with(http.request.uri.path, \"/GameData\") and not http.request.method in {\"GET\" \"HEAD\"}"
    description = "Reads only"
  }
  rules {
    action      = "managed_challenge"
    expression  = "starts_with(http.request.uri.path, \"/GameData\") and len(http.request.uri.query) > 0"
    description = "No query strings on this endpoint"
  }
}

resource "cloudflare_ruleset" "gamedata_ratelimit" {
  zone_id = var.zone_id
  name    = "GameData rate limit"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules {
    action      = "managed_challenge"
    expression  = "starts_with(http.request.uri.path, \"/GameData\")"
    description = "Flood ceiling"
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 1200        # 60 on Business+, with the line below
      # requests_to_origin = true       # Business / Enterprise only
      mitigation_timeout  = 60
    }
  }
}
```

`cf.colo.id` is in the characteristics because Cloudflare requires per-data-center
counting on non-Enterprise plans; leaving it out is the usual reason one of these
fails to apply.
