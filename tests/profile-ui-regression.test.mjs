import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_UI_TOKENS, getProfileSegmentStyle } from '../src/lib/profileUi.ts';

test('segmented control: mapeia estado ativo/inativo com tokens especificados', () => {
  assert.equal(PROFILE_UI_TOKENS.activeBackground, '#DBEAFE');
  assert.equal(PROFILE_UI_TOKENS.activeText, '#1E3A8A');
  assert.equal(PROFILE_UI_TOKENS.activeBorder, '#93C5FD');
  assert.equal(PROFILE_UI_TOKENS.inactiveBackground, '#FFFFFF');
  assert.equal(PROFILE_UI_TOKENS.inactiveText, '#334155');
  assert.equal(PROFILE_UI_TOKENS.inactiveBorder, '#CBD5E1');
  assert.equal(PROFILE_UI_TOKENS.focusRing, '#60A5FA');
  assert.equal(PROFILE_UI_TOKENS.focusBorder, '#2563EB');

  const activeAdult = getProfileSegmentStyle('adulto', 'adulto');
  const inactivePeds = getProfileSegmentStyle('adulto', 'pediatria');

  assert.equal(activeAdult.background, '#DBEAFE');
  assert.equal(activeAdult.color, '#1E3A8A');
  assert.equal(activeAdult.borderColor, '#93C5FD');
  assert.equal(inactivePeds.background, '#FFFFFF');
  assert.equal(inactivePeds.color, '#334155');
  assert.equal(inactivePeds.borderColor, '#CBD5E1');
});
