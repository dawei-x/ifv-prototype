import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const repoName = 'ifv-prototype'; 

export default defineConfig({
	base: `/${repoName}/`,
	plugins: [sveltekit()]
});