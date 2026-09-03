/**
 * Wild Willows - Harper backend resources.
 *
 * All game-state mutations flow through these endpoints. The frontend is
 * never trusted: inventory math, crafting costs, placement rules, biome
 * health, ecological balance, animal-return conditions and biome unlocks
 * are all validated and computed here, inside Harper.
 *
 * Built with `npm run build:server` (esbuild) into resources.js, which the
 * `jsResource` plugin loads.
 *
 * THIS FILE IS THE ENTRY POINT AND NOTHING ELSE. Harper serves exactly the
 * names exported below, so this is the one place that fixes the public API
 * surface; the implementation lives in the modules it re-exports from. The
 * layering runs top-down, each module depending only on the ones above it:
 *
 *   core             db handle, GameError + refusal counters, pure helpers,
 *                    global constants, the per-world activity feed
 *   store            salvage + safe record access, RollupCache
 *   keys             the world/area key contract and its migration
 *   worlds           world lookup, seed reconciliation, save repair
 *   home             home styles, upgrade tracks, room geometry, tents
 *   player           field guides, appearance, passcodes, write coalescing
 *   metrics          the metrics blob, daily counters, the play-time clock
 *   biome            health, balance, animal returns, unlocks, crafting
 *   tasks            daily tasks, custom goals, the client state snapshot
 *   rate-limit       token buckets, client address, body size cap
 *   achievements     triggers and awarding
 *   completion       the "what is left?" tally, measured with src/completion.ts
 *                    so the dashboard and the player's own panel agree
 *   endpoints-*      the Resource classes, grouped by who calls them:
 *                    game (players), metrics (heartbeat + roll-up),
 *                    admin (operators), telemetry (anonymous counters),
 *                    pages (the static site)
 *
 * The dependency arrows do run backwards in a few places - a save migration in
 * worlds calls recalcBiome, sanitizePlayer reads the metrics blob - but every
 * one of those is a call-time reference from inside a function body, never a
 * value read while a module is still initialising. Keep it that way.
 *
 * Harper globals (`databases`, `Resource`) are declared once in harper.d.ts.
 */

export { healthCapForReturns } from './biome';
export {
	AppendFeed,
	ChangePasscode,
	ChestTransfer,
	ClaimTask,
	CollectResource,
	CraftItem,
	CreatePlayer,
	DashboardAuth,
	DeleteDemoSave,
	DeletePlayer,
	DiscardItem,
	ExportDemoSave,
	GameData,
	GameState,
	HarvestPlacement,
	LoginPlayer,
	MoveObject,
	MyWorlds,
	ObserveAnimal,
	PlaceObject,
	Plant,
	RecalcBiome,
	RemoveObject,
	Rest,
	SetGoals,
	SetHomeColors,
	SetHomeStyle,
	SetPlacementColor,
	SyncPlayer,
	Terraform,
	UpdateAppearance,
	UpgradeHome,
	UpgradeTool,
	Version,
} from './endpoints-game';
export { Heartbeat, Metrics, MetricsPlayers, MetricsSummary } from './endpoints-metrics';
export { DevTools, ServerHealth, SystemProbe } from './endpoints-admin';
export {
	AppOpen,
	ClearProblem,
	DeleteSoloMetrics,
	GameplayHealth,
	LandingEvent,
	LandingStats,
	LessonEvent,
	LessonStats,
	ListFeedback,
	ReportClientError,
	ReportSaveIncident,
	SaveHealth,
	SubmitFeedback,
	SyncMetrics,
} from './endpoints-telemetry';

// The static pages are exported under the exact URL paths they serve. String
// export names keep the hyphen, and Harper strips a trailing .ico/.jpg/.svg
// extension. The PDFs are exported under BOTH the bare name and the .pdf one,
// because the extension-stripping list is Harper's, not ours - this way
// /educator-guide.pdf resolves whether or not Harper trims the suffix first.
export {
	LandingPage as home,
	SpanishPage as es,
	PrivacyPage as privacy,
	AgeRatingPage as 'age-rating',
	SupportPage as support,
	AboutPage as about,
	TeachersPage as teachers,
	LearnPage as learn,
	DevelopersPage as developers,
	DashboardPage as dashboard,
	Favicon as favicon,
	OgImage as 'og-image',
	Screenshot as img,
	Theme as theme,
	EducatorGuidePdf as 'educator-guide',
	EducatorGuidePdf as 'educator-guide.pdf',
	StudentWorksheetsPdf as 'student-worksheets',
	StudentWorksheetsPdf as 'student-worksheets.pdf',
	RobotsTxt as robots,
	RobotsTxt as 'robots.txt',
	SitemapXml as sitemap,
	SitemapXml as 'sitemap.xml',
} from './endpoints-pages';
