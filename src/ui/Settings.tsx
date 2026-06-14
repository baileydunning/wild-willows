import { useState } from 'react';
import { api, forgetSave } from '../api';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import type { Appearance } from '../types';
import { CharacterPreview, Icon } from './icons';

/** Reusable appearance picker (used by Settings; mirrors the New Game creator). */
export function AppearanceEditor({ value, onChange }: { value: Appearance; onChange: (a: Appearance) => void }) {
	const { data } = useGame();
	const opts = data?.appearanceOptions;
	const hatLabel: Record<string, string> = { straw: 'Straw hat', leaf: 'Leaf hat', beanie: 'Beanie', cap: 'Cap', bucket: 'Bucket hat', flower: 'Flower crown', party: 'Party hat', none: 'No hat' };
	const hairstyleLabel: Record<string, string> = { short: 'Short', long: 'Long', curly: 'Curly', 'curly-long': 'Curly long', bun: 'Bun', ponytail: 'Ponytail', pigtails: 'Pigtails', afro: 'Afro', mohawk: 'Mohawk' };
	const bodyLabel: Record<string, string> = { slim: 'Slender', round: 'Sturdy' };
	const set = (patch: Partial<Appearance>) => onChange({ ...value, ...patch });

	return (
		<div className="creator-cols">
			<div className="creator-preview">
				<CharacterPreview appearance={value} size={120} />
			</div>
			<div className="creator-options">
				<div className="swatch-row">
					<span className="swatch-label">Skin</span>
					{(opts?.skins || []).map((c) => (
						<button type="button" key={c} className={`swatch-btn ${value.skin === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => set({ skin: c })} aria-label={`Skin ${c}`} />
					))}
					<label className="swatch-pick" title="Pick any skin color">
						<Icon name="eyedropper" size={14} />
						<input type="color" value={value.skin} onChange={(e) => set({ skin: e.target.value })} aria-label="Custom skin color" />
					</label>
				</div>
				<div className="swatch-row">
					<span className="swatch-label">Hair</span>
					{(opts?.hair || []).map((c) => (
						<button type="button" key={c} className={`swatch-btn ${value.hair === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => set({ hair: c })} aria-label={`Hair ${c}`} />
					))}
					<label className="swatch-pick" title="Pick any hair color">
						<Icon name="eyedropper" size={14} />
						<input type="color" value={value.hair} onChange={(e) => set({ hair: e.target.value })} aria-label="Custom hair color" />
					</label>
				</div>
				<div className="swatch-row">
					<span className="swatch-label">Style</span>
					{(opts?.hairstyles || []).map((h) => (
						<button type="button" key={h} className={`hat-btn ${value.hairstyle === h ? 'sel' : ''}`} onClick={() => set({ hairstyle: h })}>
							{hairstyleLabel[h] || h}
						</button>
					))}
				</div>
				<div className="swatch-row">
					<span className="swatch-label">Build</span>
					{(opts?.bodies || []).map((b) => (
						<button type="button" key={b} className={`hat-btn ${value.body === b ? 'sel' : ''}`} onClick={() => set({ body: b })}>
							{bodyLabel[b] || b}
						</button>
					))}
				</div>
				<div className="swatch-row">
					<span className="swatch-label">Outfit</span>
					{(opts?.outfits || []).map((c) => (
						<button type="button" key={c} className={`swatch-btn ${value.outfit === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => set({ outfit: c })} aria-label={`Outfit ${c}`} />
					))}
					<label className="swatch-pick" title="Pick any outfit color">
						<Icon name="eyedropper" size={14} />
						<input type="color" value={value.outfit} onChange={(e) => set({ outfit: e.target.value })} aria-label="Custom outfit color" />
					</label>
				</div>
				<div className="swatch-row">
					<span className="swatch-label">Hat</span>
					{(opts?.hats || []).map((h) => (
						<button type="button" key={h} className={`hat-btn ${value.hat === h ? 'sel' : ''}`} onClick={() => set({ hat: h })}>
							{hatLabel[h] || h}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

export function SettingsPanel() {
	const { state, setPanel, notify, refresh, logout } = useGame();
	const defaults: Appearance = {
		skin: '#eec39a', hair: '#6e4a33', outfit: '#4a7c59', hat: 'straw', hairstyle: 'short', body: 'slim',
	};
	const [appearance, setAppearance] = useState<Appearance>({ ...defaults, ...(state?.player.appearance || {}) });
	const [saving, setSaving] = useState(false);
	const [passcode, setPasscode] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!state) return null;
	const player = state.player;

	const saveLook = async () => {
		setSaving(true);
		setError(null);
		try {
			const r = await api.updateAppearance(appearance);
			bridge.emit('appearance-changed', r.appearance);
			await refresh();
			notify('Your new look is saved.');
		} catch (e: any) {
			setError(e.message || 'Could not save your look');
		} finally {
			setSaving(false);
		}
	};

	const deleteSave = async () => {
		if (!window.confirm(`Permanently delete "${player.name}"? The preserve, journal, and all progress will be gone for good.`)) return;
		setDeleting(true);
		setError(null);
		try {
			await api.deletePlayer(player.name, passcode);
			forgetSave();
			logout();
		} catch (e: any) {
			setError(e.message || 'Could not delete the save');
			setDeleting(false);
		}
	};

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel panel-wide" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="gear" size={20} /> Settings</h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label="Close"><Icon name="close" /></button>
				</div>
				<div className="panel-body">
					<h3><Icon name="user" size={15} /> Your caretaker — {player.name}</h3>
					<AppearanceEditor value={appearance} onChange={setAppearance} />
					<div className="form-actions" style={{ justifyContent: 'flex-end' }}>
						<button className="big-btn primary" onClick={saveLook} disabled={saving}>
							<Icon name="check" /> <span>{saving ? 'Saving…' : 'Save new look'}</span>
						</button>
					</div>

					<h3><Icon name="trash" size={15} /> Delete this save</h3>
					<p className="muted small">
						Deleting "{player.name}" permanently removes the preserve, journal, chests, and all progress from Harper. Enter your
						passcode to confirm.
					</p>
					<div className="danger-row">
						<label className="field">
							<Icon name="lock" size={16} />
							<input type="password" placeholder="Passcode" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
						</label>
						<button className="delete-save-btn" style={{ width: 'auto', marginTop: 0 }} disabled={deleting || !passcode} onClick={deleteSave}>
							<Icon name="trash" size={15} /> <span>{deleting ? 'Deleting…' : 'Delete forever'}</span>
						</button>
					</div>
					{error && <p className="form-error">{error}</p>}
					<p className="build-stamp">build {new Date(__BUILD_TIME__).toLocaleString()}</p>
				</div>
			</div>
		</div>
	);
}
