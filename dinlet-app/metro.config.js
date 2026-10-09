const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

/**
 * Refuse to start from inside the PanelUI repository.
 *
 * A template is a standalone project, and this one only ever runs as a copy
 * somewhere else. Started where it is written, Node resolves past its own
 * node_modules and up into the monorepo's — so the Worklets Babel plugin comes
 * from one install and the Worklets runtime from another, and the app dies on
 * the first import with the two reporting different versions of themselves.
 * The error names neither directory, which is what makes this worth a guard
 * rather than a paragraph in a readme.
 *
 * Inert for anyone who generated a project: their app is not inside this
 * repository, so the walk finds nothing and returns.
 */
function refuseToRunInPlace(from) {
  let dir = from;

  while (true) {
    if (isPanelUICheckout(dir)) {
      throw new Error(
        `This template is being run in place, inside the PanelUI checkout at ${dir}.\n\n` +
          'It resolves its dependencies up into the monorepo from here, which is ' +
          'not what a generated project does, and the mismatched copies it finds ' +
          'fail in ways that look like bugs in the template.\n\n' +
          'Scaffold a real project instead, from the repository root:\n\n' +
          '  npm run template\n'
      );
    }

    const parent = path.resolve(dir, '..');
    if (parent === dir) return;
    dir = parent;
  }
}

/** The library's own workspace root, and nothing that merely resembles one. */
function isPanelUICheckout(dir) {
  if (!fs.existsSync(path.join(dir, 'packages', 'panelui', 'package.json'))) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return (manifest.workspaces ?? []).includes('packages/*');
  } catch {
    return false;
  }
}

refuseToRunInPlace(__dirname);

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  // Generates uniwind-types.d.ts, which is what makes `setTheme` know the
  // theme names below rather than accepting any string.
  dtsFile: './uniwind-types.d.ts',
  // Only `light` and `dark` work without being listed here. Any other theme
  // throws "it was not registered" from `setTheme`, and a change to this list
  // needs the dev server restarted rather than reloaded — a running server
  // rewrites the generated CSS from the list it started with.
  extraThemes: ['moon', 'moon-dark', 'grass', 'grass-dark'],
});
