// Sandbox-only bundler: reproduces `npm run build:server`'s esbuild step using
// rollup + the TypeScript transpiler, for environments where esbuild's native
// binary is unavailable. Output matches the esm bundle the harness imports.
import ts from 'typescript';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const resolveExt = {
	name: 'resolve-ext',
	resolveId(source, importer) {
		if (source.startsWith('node:')) return { id: source, external: true };
		if (!importer || !source.startsWith('.')) return null;
		const base = resolve(dirname(importer), source);
		for (const cand of [base, base + '.ts', base + '.tsx', base + '.json', base + '/index.ts']) {
			if (existsSync(cand)) return cand;
		}
		return null;
	},
};

const json = {
	name: 'json',
	transform(code, id) {
		if (!id.endsWith('.json')) return null;
		return { code: `export default ${code};`, map: { mappings: '' } };
	},
};

const typescript = {
	name: 'ts',
	transform(code, id) {
		if (!/\.tsx?$/.test(id)) return null;
		const out = ts.transpileModule(code, {
			compilerOptions: {
				target: ts.ScriptTarget.ES2022,
				module: ts.ModuleKind.ESNext,
				jsx: ts.JsxEmit.ReactJSX,
				esModuleInterop: true,
				moduleResolution: ts.ModuleResolutionKind.Bundler,
			},
			fileName: id,
		});
		return { code: out.outputText, map: null };
	},
};

export default {
	input: 'server/resources.ts',
	external: (id) => id.startsWith('node:'),
	plugins: [resolveExt, json, typescript],
	output: { file: 'resources.js', format: 'es' },
	onwarn(w, warn) {
		if (w.code === 'CIRCULAR_DEPENDENCY' || w.code === 'THIS_IS_UNDEFINED') return;
		warn(w);
	},
};
