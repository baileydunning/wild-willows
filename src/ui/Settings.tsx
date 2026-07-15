import { useEffect, useRef, useState } from 'react';
import { api, forgetSave, getTransport, exportActiveSolo } from '../api';
import { hatPalette } from '../color';
import { sendFeedback } from '../feedback';
import { bridge } from '../game/bridge';
import { COOP_ENABLED } from '../features';
import { useGame } from '../state';
import { visibleShortcuts } from '../shortcuts';
import { hasKey, LOCALE_NAMES, chooseLocale } from '../i18n';
import { useI18n } from '../i18n/react';
import { usePrefs, setPrefs, type TextScale, type ColorblindMode } from '../prefs';
import type { Appearance, AppearanceOptions } from '../types';
import { CharacterPreview, Icon } from './icons';

/**
 * One roll of the dice — a fully random appearance from the available options.
 * Hats usually keep their classic colors; sometimes the roll re-tints them.
 */
export function randomizeAppearance(opts: AppearanceOptions | undefined, current: Appearance): Appearance {
	if (!opts) return current;
	const pick = <T,>(arr: T[] | undefined): T | undefined =>
		arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
	const hat = pick(opts.hats) ?? current.hat;
	return {
		skin: pick(opts.skins) ?? current.skin,
		hair: pick(opts.hair) ?? current.hair,
		outfit: pick(opts.outfits) ?? current.outfit,
		hat,
		hatColor: hat !== 'none' && Math.random() < 0.35 ? (pick(opts.hatColors) ?? null) : null,
		hairstyle: pick(opts.hairstyles) ?? current.hairstyle,
		beard: pick(opts.beards) ?? current.beard ?? 'none',
		body: pick(opts.bodies) ?? current.body,
	};
}

/**
 * The appearance option rows (Skin/Hair/Style/Beard/Build/Outfit/Hat/Hat
 * color). Shared by the Settings editor below AND the New Game creator in
 * Welcome.tsx, so new looks only need adding once.
 */
export function AppearanceRows({ value, onChange }: { value: Appearance; onChange: (a: Appearance) => void }) {
	const { data } = useGame();
	const { t } = useI18n();
	const opts = data?.appearanceOptions;
	// Option labels live in the catalog (app.appearance.<group>.<id>); unknown
	// ids (newer data than this client) fall back to the raw id, as before.
	const optLabel = (group: string, id: string) => {
		const k = `app.appearance.${group}.${id}`;
		return hasKey(k) ? t(k) : id;
	};
	const set = (patch: Partial<Appearance>) => onChange({ ...value, ...patch });

	return (
		<>
			<div className="swatch-row">
				<span className="swatch-label">{t('app.appearance.skin')}</span>
				{(opts?.skins || []).map((c) => (
					<button
						type="button"
						key={c}
						className={`swatch-btn ${value.skin === c ? 'sel' : ''}`}
						style={{ background: c }}
						onClick={() => set({ skin: c })}
						aria-label={t('app.appearance.skinAria', { color: c })}
					/>
				))}
				<label className="swatch-pick" title={t('app.appearance.pickSkin')}>
					<Icon name="eyedropper" size={14} />
					<input
						type="color"
						value={value.skin}
						onChange={(e) => set({ skin: e.target.value })}
						aria-label={t('app.appearance.customSkin')}
					/>
				</label>
			</div>
			<div className="swatch-row">
				<span className="swatch-label">{t('app.appearance.hair')}</span>
				{(opts?.hair || []).map((c) => (
					<button
						type="button"
						key={c}
						className={`swatch-btn ${value.hair === c ? 'sel' : ''}`}
						style={{ background: c }}
						onClick={() => set({ hair: c })}
						aria-label={t('app.appearance.hairAria', { color: c })}
					/>
				))}
				<label className="swatch-pick" title={t('app.appearance.pickHair')}>
					<Icon name="eyedropper" size={14} />
					<input
						type="color"
						value={value.hair}
						onChange={(e) => set({ hair: e.target.value })}
						aria-label={t('app.appearance.customHair')}
					/>
				</label>
			</div>
			<div className="swatch-row">
				<span className="swatch-label">{t('app.appearance.style')}</span>
				{(opts?.hairstyles || []).map((h) => (
					<button
						type="button"
						key={h}
						className={`hat-btn ${value.hairstyle === h ? 'sel' : ''}`}
						onClick={() => set({ hairstyle: h })}
					>
						{optLabel('hairstyleLabel', h)}
					</button>
				))}
			</div>
			<div className="swatch-row">
				<span className="swatch-label">{t('app.appearance.beard')}</span>
				{(opts?.beards || []).map((b) => (
					<button
						type="button"
						key={b}
						className={`hat-btn ${(value.beard || 'none') === b ? 'sel' : ''}`}
						onClick={() => set({ beard: b })}
					>
						{optLabel('beardLabel', b)}
					</button>
				))}
			</div>
			<div className="swatch-row">
				<span className="swatch-label">{t('app.appearance.build')}</span>
				{(opts?.bodies || []).map((b) => (
					<button
						type="button"
						key={b}
						className={`hat-btn ${value.body === b ? 'sel' : ''}`}
						onClick={() => set({ body: b })}
					>
						{optLabel('bodyLabel', b)}
					</button>
				))}
			</div>
			<div className="swatch-row">
				<span className="swatch-label">{t('app.appearance.outfit')}</span>
				{(opts?.outfits || []).map((c) => (
					<button
						type="button"
						key={c}
						className={`swatch-btn ${value.outfit === c ? 'sel' : ''}`}
						style={{ background: c }}
						onClick={() => set({ outfit: c })}
						aria-label={t('app.appearance.outfitAria', { color: c })}
					/>
				))}
				<label className="swatch-pick" title={t('app.appearance.pickOutfit')}>
					<Icon name="eyedropper" size={14} />
					<input
						type="color"
						value={value.outfit}
						onChange={(e) => set({ outfit: e.target.value })}
						aria-label={t('app.appearance.customOutfit')}
					/>
				</label>
			</div>
			<div className="swatch-row">
				<span className="swatch-label">{t('app.appearance.hat')}</span>
				{(opts?.hats || []).map((h) => (
					// picking a hat starts from its classic colors; the eyedropper re-tints
					<button
						type="button"
						key={h}
						className={`hat-btn ${value.hat === h ? 'sel' : ''}`}
						onClick={() => set({ hat: h, hatColor: null })}
					>
						{optLabel('hatLabel', h)}
					</button>
				))}
				{value.hat !== 'none' && (
					<label
						className="swatch-pick"
						title={value.hat === 'flower' ? t('app.appearance.recolorCrown') : t('app.appearance.recolorHat')}
					>
						<Icon name="eyedropper" size={14} />
						<input
							type="color"
							value={value.hatColor || hatPalette(value.hat).a}
							onChange={(e) => set({ hatColor: e.target.value })}
							aria-label={t('app.appearance.customHat')}
						/>
					</label>
				)}
			</div>
		</>
	);
}

/** Reusable appearance picker (used by Settings; the New Game creator shares AppearanceRows). */
export function AppearanceEditor({ value, onChange }: { value: Appearance; onChange: (a: Appearance) => void }) {
	return (
		<div className="creator-cols">
			<div className="creator-preview">
				<CharacterPreview appearance={value} size={120} />
			</div>
			<div className="creator-options">
				<AppearanceRows value={value} onChange={onChange} />
			</div>
		</div>
	);
}

/** Accessibility controls (reduce motion, colorblind/high-contrast, text size).
 *  Shared by the in-game Settings panel and the title-screen Accessibility modal. */
export function AccessibilityControls() {
	const { t } = useI18n();
	const prefs = usePrefs();
	return (
		<>
			<div className="a11y-row">
				<span className="a11y-label">
					<b>{t('app.settings.reduceMotion')}</b>
					<span className="muted small">{t('app.settings.reduceMotionHint')}</span>
				</span>
				<label className="switch">
					<input
						type="checkbox"
						checked={prefs.reduceMotion}
						onChange={(e) => setPrefs({ reduceMotion: e.target.checked })}
						aria-label={t('app.settings.reduceMotion')}
					/>
					<span className="track" />
					<span className="thumb" />
				</label>
			</div>
			<div className="a11y-row">
				<span className="a11y-label">
					<b>{t('app.settings.colorblind')}</b>
					{/* The hint is per-mode so the menu teaches what each condition is and
					    what the setting does — not just a label. */}
					<span className="muted small">{t(`app.settings.colorblindHint.${prefs.colorblindMode}`)}</span>
				</span>
				<select
					aria-label={t('app.settings.colorblind')}
					value={prefs.colorblindMode}
					onChange={(e) => setPrefs({ colorblindMode: e.target.value as ColorblindMode })}
				>
					<option value="off">{t('app.settings.colorblindOff')}</option>
					<option value="redgreen">{t('app.settings.colorblindRedGreen')}</option>
					<option value="blueyellow">{t('app.settings.colorblindBlueYellow')}</option>
					<option value="mono">{t('app.settings.colorblindMono')}</option>
				</select>
			</div>
			<div className="a11y-row">
				<span className="a11y-label">
					<b>{t('app.settings.dyslexiaFont')}</b>
					<span className="muted small">{t('app.settings.dyslexiaFontHint')}</span>
				</span>
				<label className="switch">
					<input
						type="checkbox"
						checked={prefs.dyslexiaFont}
						onChange={(e) => setPrefs({ dyslexiaFont: e.target.checked })}
						aria-label={t('app.settings.dyslexiaFont')}
					/>
					<span className="track" />
					<span className="thumb" />
				</label>
			</div>
			<div className="craft-filter lang-filter">
				<label htmlFor="settings-textscale">{t('app.settings.textSize')}:</label>
				<select
					id="settings-textscale"
					value={prefs.textScale}
					onChange={(e) => setPrefs({ textScale: e.target.value as TextScale })}
				>
					<option value="sm">{t('app.settings.textSm')}</option>
					<option value="md">{t('app.settings.textMd')}</option>
					<option value="lg">{t('app.settings.textLg')}</option>
					{/* OpenDyslexic already runs large, so extra-large overflows the UI. */}
					<option value="xl" disabled={prefs.dyslexiaFont}>
						{t('app.settings.textXl')}
					</option>
				</select>
			</div>
		</>
	);
}

export function SettingsPanel() {
	const { state, setPanel, notify, refresh, logout, worlds, activeWorldId } = useGame();
	const { t, locale } = useI18n();
	const activeWorld = worlds?.find((w) => w.worldId === activeWorldId);
	const isCoop = COOP_ENABLED && !!activeWorld && !activeWorld.solo;
	const defaults: Appearance = {
		skin: '#eec39a',
		hair: '#6e4a33',
		outfit: '#4a7c59',
		hat: 'straw',
		hairstyle: 'short',
		beard: 'none',
		body: 'slim',
	};
	const [appearance, setAppearance] = useState<Appearance>({ ...defaults, ...(state?.player.appearance || {}) });
	const [saving, setSaving] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [passcode, setPasscode] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [curPass, setCurPass] = useState('');
	const [newPass, setNewPass] = useState('');
	const [confirmPass, setConfirmPass] = useState('');
	const [changing, setChanging] = useState(false);
	const [fbMessage, setFbMessage] = useState('');
	const [fbEmail, setFbEmail] = useState('');
	const [sendingFb, setSendingFb] = useState(false);
	// After a confirmed send, "Sent!" replaces the button for a little while.
	const [fbSent, setFbSent] = useState(false);
	const fbSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (fbSentTimer.current) clearTimeout(fbSentTimer.current);
		},
		[],
	);

	if (!state) return null;
	const player = state.player;
	// Solo saves have no real passcode (a fixed local token) and are deleted from
	// the title screen's load menu, so both account sections only apply online.
	const isSolo = getTransport() === 'solo';

	const saveLook = async () => {
		setSaving(true);
		setError(null);
		try {
			const r = await api.updateAppearance(appearance);
			bridge.emit('appearance-changed', r.appearance);
			await refresh();
			notify(t('app.settings.lookSaved'));
		} catch (e: any) {
			setError(e.message || t('app.settings.errSaveLook'));
		} finally {
			setSaving(false);
		}
	};

	// Export the active solo save to a downloadable JSON file — the whole world
	// plus the caretaker's name and look — so the player has an offline backup.
	const exportSave = async () => {
		setExporting(true);
		setError(null);
		try {
			const out = await exportActiveSolo();
			if (!out) {
				setError(t('app.settings.errExport'));
				return;
			}
			const blob = new Blob([out.contents], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = out.filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			notify(t('app.settings.saveExported'));
		} catch (e: any) {
			setError(e.message || t('app.settings.errExport'));
		} finally {
			setExporting(false);
		}
	};

	const changePass = async () => {
		setError(null);
		if (newPass.length < 4 || newPass.length > 32) {
			setError(t('app.settings.errPasscodeLength'));
			return;
		}
		if (newPass !== confirmPass) {
			setError(t('app.settings.errPasscodeMatch'));
			return;
		}
		setChanging(true);
		try {
			await api.changePasscode(curPass, newPass);
			setCurPass('');
			setNewPass('');
			setConfirmPass('');
			notify(t('app.settings.passcodeUpdated'));
		} catch (e: any) {
			setError(e.message || t('app.settings.errChangePasscode'));
		} finally {
			setChanging(false);
		}
	};

	const submitFeedback = async () => {
		setError(null);
		setSendingFb(true);
		try {
			const { sent } = await sendFeedback(fbMessage, fbEmail, state);
			setFbMessage('');
			setFbEmail('');
			if (sent) {
				// Confirmed by the server: swap the button for "Sent!" for 5s.
				setFbSent(true);
				if (fbSentTimer.current) clearTimeout(fbSentTimer.current);
				fbSentTimer.current = setTimeout(() => setFbSent(false), 5000);
			} else {
				notify(t('app.settings.feedbackQueued'));
			}
		} catch (e: any) {
			setError(e.message || t('app.settings.errFeedback'));
		} finally {
			setSendingFb(false);
		}
	};

	const deleteSave = async () => {
		if (!window.confirm(t('app.confirm.deleteSave', { name: player.name }))) return;
		setDeleting(true);
		setError(null);
		try {
			await api.deletePlayer(player.name, passcode);
			forgetSave();
			logout();
		} catch (e: any) {
			setError(e.message || t('app.settings.errDelete'));
			setDeleting(false);
		}
	};

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						<Icon name="gear" size={20} /> {t('app.settings.title')}
					</h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label={t('app.common.close')}>
						<Icon name="close" />
					</button>
				</div>
				<div className="panel-body settings-body">
					<h3>
						<Icon name="user" size={15} /> {t('app.settings.yourCaretaker', { name: player.name })}
					</h3>
					<AppearanceEditor value={appearance} onChange={setAppearance} />
					<div className="form-actions end">
						<button className="big-btn primary" onClick={saveLook} disabled={saving}>
							<Icon name="check" /> <span>{saving ? t('app.settings.saving') : t('app.settings.saveLook')}</span>
						</button>
					</div>

					<h3>
						<Icon name="globe" size={15} /> {t('app.settings.language')}
					</h3>
					<div className="craft-filter lang-filter">
						<label htmlFor="settings-language">{t('app.settings.language')}:</label>
						<select id="settings-language" value={locale} onChange={(e) => void chooseLocale(e.target.value)}>
							{Object.entries(LOCALE_NAMES).map(([code, name]) => (
								<option key={code} value={code}>
									{name}
								</option>
							))}
						</select>
					</div>

					<h3>
						<Icon name="sliders" size={15} /> {t('app.settings.accessibility')}
					</h3>
					<AccessibilityControls />

					<h3>
						<Icon name="keyboard" size={15} /> {t('app.settings.controls')}
					</h3>
					<div className="key-list">
						{visibleShortcuts(isCoop).map((k) => (
							<div className="key-row" key={k.does}>
								<span className="kbds">
									{k.keys.map((key) => (
										<kbd key={key}>{key}</kbd>
									))}
								</span>
								<span>{t(k.does)}</span>
							</div>
						))}
					</div>

					{isSolo && (
						<>
							<h3>
								<Icon name="download" size={15} /> {t('app.settings.exportSaveTitle')}
							</h3>
							<p className="muted small">{t('app.settings.exportSaveHint')}</p>
							<div className="form-actions end">
								<button className="big-btn primary" onClick={exportSave} disabled={exporting}>
									<Icon name="download" size={15} />{' '}
									<span>{exporting ? t('app.settings.exporting') : t('app.settings.exportSave')}</span>
								</button>
							</div>
						</>
					)}

					{!isSolo && (
						<>
							<h3>
								<Icon name="lock" size={15} /> {t('app.settings.changePasscode')}
							</h3>
							<p className="muted small">{t('app.settings.changePasscodeHint')}</p>
							<div className="pass-row">
								<label className="field">
									<Icon name="lock" size={16} />
									<input
										type="password"
										placeholder={t('app.settings.currentPasscode')}
										value={curPass}
										onChange={(e) => setCurPass(e.target.value)}
									/>
								</label>
								<label className="field">
									<Icon name="lock" size={16} />
									<input
										type="password"
										placeholder={t('app.settings.newPasscode')}
										value={newPass}
										onChange={(e) => setNewPass(e.target.value)}
									/>
								</label>
								<label className="field">
									<Icon name="lock" size={16} />
									<input
										type="password"
										placeholder={t('app.settings.confirmNew')}
										value={confirmPass}
										onChange={(e) => setConfirmPass(e.target.value)}
									/>
								</label>
								<button
									className="big-btn primary"
									style={{ width: 'auto', marginTop: 0 }}
									disabled={changing || !curPass || !newPass || !confirmPass}
									onClick={changePass}
								>
									<Icon name="check" size={15} />{' '}
									<span>{changing ? t('app.settings.updating') : t('app.settings.updatePasscode')}</span>
								</button>
							</div>

							<h3>
								<Icon name="trash" size={15} /> {t('app.settings.deleteSaveTitle')}
							</h3>
							<p className="muted small">{t('app.settings.deleteSaveHint', { name: player.name })}</p>
							<div className="danger-row">
								<label className="field">
									<Icon name="lock" size={16} />
									<input
										type="password"
										placeholder={t('app.settings.passcode')}
										value={passcode}
										onChange={(e) => setPasscode(e.target.value)}
									/>
								</label>
								<button
									className="delete-save-btn"
									style={{ width: 'auto', marginTop: 0 }}
									disabled={deleting || !passcode}
									onClick={deleteSave}
								>
									<Icon name="trash" size={15} />{' '}
									<span>{deleting ? t('app.settings.deleting') : t('app.settings.deleteForever')}</span>
								</button>
							</div>
						</>
					)}

					<h3>
						<Icon name="chat" size={15} /> {t('app.settings.sendFeedback')}
					</h3>
					<p className="muted small">{t('app.settings.feedbackHint')}</p>
					<div className="feedback-row">
						<textarea
							placeholder={t('app.settings.feedbackPlaceholder')}
							value={fbMessage}
							maxLength={4000}
							onChange={(e) => setFbMessage(e.target.value)}
							aria-label={t('app.settings.feedbackAria')}
						/>
						<div className="feedback-actions">
							<label className="field">
								<Icon name="user" size={16} />
								<input
									type="email"
									placeholder={t('app.settings.emailPlaceholder')}
									value={fbEmail}
									onChange={(e) => setFbEmail(e.target.value)}
								/>
							</label>
							{fbSent ? (
								<span className="feedback-sent" role="status">
									<Icon name="check" size={15} /> <span>{t('app.settings.sent')}</span>
								</span>
							) : (
								<button
									className="big-btn primary"
									style={{ width: 'auto', marginTop: 0 }}
									disabled={sendingFb || !fbMessage.trim()}
									onClick={submitFeedback}
								>
									<Icon name="forward" size={15} />{' '}
									<span>{sendingFb ? t('app.settings.sending') : t('app.settings.sendFeedback')}</span>
								</button>
							)}
						</div>
					</div>
					{error && <p className="form-error">{error}</p>}
					<p className="build-stamp">{t('app.settings.build', { time: new Date(__BUILD_TIME__).toLocaleString() })}</p>
				</div>
			</div>
		</div>
	);
}
