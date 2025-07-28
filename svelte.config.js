// svelte.config.js
import adapter from '@sveltejs/adapter-static';

const dev = process.env.NODE_ENV === 'development';
const repoName = 'ifv-prototype';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: null
    }),
    paths: {
      base: dev ? '' : `/${repoName}`
    }
  }
};