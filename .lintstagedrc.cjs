/**
 * lint-staged configuration for the Loomy monorepo.
 *
 * - Frontend files (apps/frontend/**) are formatted with Prettier and linted with
 *   ESLint using the local config in apps/frontend/.
 * - Python files (api/app/**) are linted and formatted with ruff via uv.
 *
 * Paths are absolute when passed in by lint-staged; we convert them to
 * package-relative paths so each tool sees the paths it expects.
 */
const path = require('path');

const quote = (p) => `"${p.replace(/\\/g, '/')}"`;

const toRelative = (files, baseDir) =>
  files.map((f) => path.relative(path.resolve(baseDir), f).replace(/\\/g, '/'));

module.exports = {
  'apps/frontend/**/*.{ts,tsx,js,jsx}': (files) => {
    const rel = toRelative(files, 'apps/frontend').map(quote).join(' ');
    return [
      `npm --prefix apps/frontend exec -- prettier --write ${rel}`,
      `npm --prefix apps/frontend exec -- eslint --fix ${rel}`,
    ];
  },

  'apps/frontend/**/*.{css,scss,json,md,yml,yaml,html}': (files) => {
    const rel = toRelative(files, 'apps/frontend').map(quote).join(' ');
    return [`npm --prefix apps/frontend exec -- prettier --write ${rel}`];
  },

  'api/app/**/*.py': (files) => {
    const rel = toRelative(files, 'api/app').map(quote).join(' ');
    return [
      `bash -c "cd api/app && uv run ruff check --fix ${rel}"`,
      `bash -c "cd api/app && uv run ruff format ${rel}"`,
    ];
  },

  '*.{md,yml,yaml,json}': (files) => {
    const rel = files.map((f) => quote(path.relative(process.cwd(), f))).join(' ');
    return [`npm --prefix apps/frontend exec -- prettier --write ${rel}`];
  },
};
