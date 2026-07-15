/**
 * Session-scoped, browser-style history for the field journal. Every stop you
 * visit — a biome's entry list, its food web, the all-animals overview, or an
 * individual animal card — is recorded, and back/forward walk the trail in
 * order (playtest request: flip between entries AND the list/food-web views).
 * Module-scoped so it survives the panel closing and reopening, like the
 * crafting menu's memory.
 */

export type JournalLoc =
	| { kind: 'view'; tab: string; view: 'list' | 'web' }
	| { kind: 'animal'; id: string };

const same = (a: JournalLoc | undefined, b: JournalLoc): boolean => {
	if (!a || a.kind !== b.kind) return false;
	if (a.kind === 'animal' && b.kind === 'animal') return a.id === b.id;
	if (a.kind === 'view' && b.kind === 'view') return a.tab === b.tab && a.view === b.view;
	return false;
};

const hist: JournalLoc[] = [];
let idx = -1;
const listeners = new Set<() => void>();
const notify = () => { for (const l of listeners) l(); };

export const journalNav = {
	current(): JournalLoc | undefined {
		return hist[idx];
	},
	/**
	 * Record a visit. Re-visiting the current stop is a no-op — that's what
	 * keeps back/forward from re-recording the stops they navigate to.
	 */
	visit(loc: JournalLoc) {
		if (same(hist[idx], loc)) return;
		hist.splice(idx + 1); // a fresh visit clears the forward tail
		hist.push(loc);
		idx = hist.length - 1;
		notify();
	},
	canBack(): boolean {
		return idx > 0;
	},
	canForward(): boolean {
		return idx < hist.length - 1;
	},
	back(): JournalLoc | undefined {
		if (!this.canBack()) return undefined;
		const loc = hist[--idx];
		notify();
		return loc;
	},
	forward(): JournalLoc | undefined {
		if (!this.canForward()) return undefined;
		const loc = hist[++idx];
		notify();
		return loc;
	},
	/** The journal panel listens so back/forward can retarget its tab/view. */
	subscribe(fn: () => void): () => void {
		listeners.add(fn);
		return () => { listeners.delete(fn); };
	},
};
