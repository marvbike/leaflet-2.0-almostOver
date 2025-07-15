import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const plugin_name = pkg.name;
const input = pkg.module;

// --- CONFIGURATION ---

const external = Object.keys(pkg.peerDependencies || {});

const globals = {
	'leaflet': 'L',
	'd3': 'd3',
	'leaflet-i18n': 'L.i18n'
};

// --- BUILD DEFINITIONS ---

const plugins = [
	// Add explicit options to the resolve plugin
	resolve({
		browser: true,
		preferBuiltins: false
	}),
	commonjs()
];

export default [
	//** "leaflet-elevation.js" (UMD Build) **//
	{
		input: input,
		output: {
			file: "dist/" + plugin_name + ".js",
			format: "umd",
			sourcemap: true,
			name: 'LeafletAlmostOver',
			globals: globals,
			freeze: false,
		},
		external: external,
		plugins: plugins
	},

	//** (UMD Build) **//
	{
		input: input,
		output: {
			file: "dist/" + plugin_name + ".min.js",
			format: "umd",
			sourcemap: true,
			name: 'LeafletAlmostOver',
			globals: globals,
			freeze: false,
		},
		external: external,
		plugins: plugins.concat(terser())
	},
];
