import test from 'node:test';
import assert from 'node:assert/strict';

test('skills workspace declares application root manifest', async () => {
  const manifest = await import('../agent.app.config.json', { with: { type: 'json' } });
  assert.equal(manifest.default.app.key, 'sdkwork-skills');
});
