/* eslint-env node, jest */
// Native resources render before React Native starts. Check this independent
// copy so a future palette edit cannot leave the real alarm on an old brand.
const {readFileSync} = require('fs');
const {resolve} = require('path');

const {darkScheme, lightScheme} = require('../schemes');

describe.each([
  ['light', lightScheme],
  ['dark', darkScheme],
])('%s native brand mirror', (appearance, scheme) => {
  it('matches the React Native palette used by native alarms and the launcher', () => {
    const xml = readFileSync(
      resolve(__dirname, '../../../../android/app/src/main/res/values/colors.xml'),
      'utf8',
    );
    const roles = [
      'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
      'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
      'surface', 'surfaceContainer', 'onSurface', 'onSurfaceVariant', 'outline', 'error',
    ];
    for (const role of roles) {
      const suffix = role.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      const name = `brand_${appearance}_${suffix}`;
      const match = xml.match(new RegExp(`<color name="${name}">([^<]+)</color>`));
      expect(match?.[1].toUpperCase()).toBe(scheme[role].toUpperCase());
    }
  });
});
