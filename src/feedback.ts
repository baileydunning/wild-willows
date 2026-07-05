// Player feedback → the hosted Harper's Feedback table (the developer reads
// it back with the admin-only GET /ListFeedback/ endpoint).
//
// Feedback ALWAYS travels over the network to the hosted Harper — even from
// the solo desktop build, whose game transport is the offline in-app backend —
// because it has to land in the shared table. When the network isn't there
// (desktop offline, flaky wifi), the item is queued in localStorage and
// retried at the start of every session until the server confirms it stored
// the feedback; only then is it deleted from the queue.

import { COOP_BASE_URL, IS_DESKTOP, getTransport } from './api';
import { t } from './i18n';
import { APP_VERSION, BUILD_TIME, detectOS } from './platform';
import type { GameState } from './types';

const QUEUE_KEY = 'wild-willows:feedback-queue';

export interface FeedbackItem {
	message: string;
	replyTo: string | null;
	metrics: Record<string, any>;
	queuedAt: number;
}

// ------------------------------------------------------------ local queue

function readQueue(): FeedbackItem[] {
	try {
		const raw = localStorage.getItem(QUEUE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return []; // private mode / corrupt entry — start clean
	}
}

function writeQueue(items: FeedbackItem[]): void {
	try {
		if (items.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
		else localStorage.removeItem(QUEUE_KEY);
	} catch {
		/* private mode etc. — queueing is best-effort */
	}
}

export const pendingFeedbackCount = () => readQueue().length;

// ------------------------------------------------------------ metrics blob
// Light diagnostic context attached to every piece of feedback so a report
// like "the game feels slow" arrives with the build, platform, and progress
// info needed to make sense of it. No secrets, nothing personally identifying
// beyond what the player typed.

export function gatherFeedbackMetrics(state: GameState | null): Record<string, any> {
	const m: Record<string, any> = {
		version: APP_VERSION,
		build: BUILD_TIME,
		platform: IS_DESKTOP ? 'desktop' : 'web',
		os: detectOS(), // mac / windows / linux / …
		mode: getTransport(), // solo | coop | web
		userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
	};
	const p: any = state?.player;
	if (p) {
		m.playerName = p.name;
		m.tutorialStep = p.tutorialStep ?? 0;
		m.unlockedBiomes = (p.unlockedBiomes || []).join(', ');
		m.achievements = state?.achievements?.length ?? 0;
		// Server-side metrics blob (playtime/session counters) when the snapshot has it.
		if (p.metrics) {
			m.playMinutes = Math.round((p.metrics.playSeconds || 0) / 60);
			m.sessions = p.metrics.sessions || 0;
		}
	}
	return m;
}

// ------------------------------------------------------------ sending

/**
 * POST one item to the hosted Harper. Returns 'sent' when the server stored it
 * (safe to delete locally), 'invalid' when the server rejected it as malformed
 * (retrying will never help — drop it), or 'retry' for network/server trouble.
 */
async function postFeedback(item: FeedbackItem): Promise<'sent' | 'invalid' | 'retry'> {
	// Desktop talks to the hosted Harper; the web build talks to its own origin.
	const base = IS_DESKTOP ? COOP_BASE_URL : '';
	try {
		const res = await fetch(`${base}/SubmitFeedback/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(item),
			// A hung (not just down) Harper must never leave the send button
			// spinning forever — time out and queue instead.
			signal: AbortSignal.timeout(10_000),
		});
		if (res.ok) {
			const body = await res.json().catch(() => null);
			return body?.ok ? 'sent' : 'retry';
		}
		return res.status >= 400 && res.status < 500 && res.status !== 429 ? 'invalid' : 'retry';
	} catch {
		return 'retry'; // offline / DNS / timeout — keep it queued
	}
}

/**
 * Send feedback now, or queue it locally if the network isn't cooperating.
 * Returns { sent: true } on confirmed delivery, { sent: false } when queued.
 * Throws only when the server explicitly rejected the content (e.g. bad email).
 */
export async function sendFeedback(message: string, replyTo: string, state: GameState | null): Promise<{ sent: boolean }> {
	const item: FeedbackItem = {
		message: message.trim(),
		replyTo: replyTo.trim() || null,
		metrics: gatherFeedbackMetrics(state),
		queuedAt: Date.now(),
	};
	const result = await postFeedback(item);
	if (result === 'sent') return { sent: true };
	if (result === 'invalid') throw new Error(t('app.error.feedbackRejected'));
	writeQueue([...readQueue(), item]);
	return { sent: false };
}

// ------------------------------------------------------------ queue flush

let flushing = false;

/**
 * Retry everything in the offline queue. Called at the start of each session;
 * items are deleted only once the server confirms it stored them. Stops at the
 * first network failure (the rest would fail the same way) and never throws.
 */
export async function flushFeedbackQueue(): Promise<void> {
	if (flushing) return;
	flushing = true;
	try {
		let queue = readQueue();
		while (queue.length) {
			const result = await postFeedback(queue[0]);
			if (result === 'retry') break; // still offline — try again next session
			queue = queue.slice(1); // 'sent' (confirmed) or 'invalid' (never sendable) — remove
			writeQueue(queue);
		}
	} finally {
		flushing = false;
	}
}
