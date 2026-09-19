/**
 * Application upload declaration conformance (`DRIVE_SPEC.md` §18).
 *
 * The declaration file is the authority; the constants module carries its values into code so
 * call sites do not repeat literals. This test keeps the two from drifting.
 *
 * This suite is `.mjs` because the app root runs `node --test tests/*.test.mjs`. The constants
 * module is TypeScript, so it is read and pattern-matched rather than imported — the assertion
 * target is still the real file on disk, so a divergence still fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DECLARATION_PATH = path.join(appRoot, 'specs/upload.declaration.json');
const APP_CONFIG_PATH = path.join(appRoot, 'sdkwork.app.config.json');
const CONSTANTS_PATH = path.join(
  appRoot,
  'packages/sdkwork-skills-pc-core/src/sdk/uploadDeclaration.ts',
);

/** §8.1 standard upload profiles. A profile outside this set is a contract violation. */
const STANDARD_UPLOAD_PROFILES = new Set([
  'generic',
  'video',
  'image',
  'audio',
  'document',
  'archive',
  'text',
  'dataset',
  'attachment',
  'avatar',
  'thumbnail',
]);

/** §9.4 reserves `im` for Drive; an application must not declare or send it. */
const RESERVED_SCENES = new Set(['im']);

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const APP_RESOURCE_TYPE = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+$/;

function loadDeclaration() {
  return JSON.parse(fs.readFileSync(DECLARATION_PATH, 'utf8'));
}

function loadCanonicalAppId() {
  const config = JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf8'));
  const appId = config.backend?.appId ?? config.app?.key;
  assert.ok(appId, 'sdkwork.app.config.json does not declare an app identity.');
  return appId;
}

/**
 * Pull the declared identity values out of the constants module.
 *
 * A module may factor a value into a shared constant (`source: SKILLS_UPLOAD_SOURCE`), so this
 * resolves single-quoted string constants declared in the same file before reading the entry
 * blocks. A value that is neither a literal nor a resolvable local constant comes back
 * `undefined` and fails the agreement assertion — the intended outcome, because such a value
 * could not be verified against the declaration.
 */
function readDeclaredConstantValues(source) {
  const stringConstants = new Map();
  for (const match of source.matchAll(
    /\bexport const ([A-Z0-9_]+)\s*=\s*'([^']+)'\s*as const/g,
  )) {
    stringConstants.set(match[1], match[2]);
  }

  const resolve = (raw) => {
    if (raw === undefined) {
      return undefined;
    }
    const literal = raw.match(/^'([^']+)'$/);
    if (literal) {
      return literal[1];
    }
    return stringConstants.get(raw.trim());
  };

  const values = [];
  const entryBlocks = source.split(/\bexport const SKILLS_[A-Z0-9_]*_UPLOAD\s*=\s*\{/);
  for (const block of entryBlocks.slice(1)) {
    const body = block.slice(0, block.indexOf('} as const'));
    const pick = (key) =>
      resolve(body.match(new RegExp(`\\b${key}:\\s*('[^']+'|[A-Za-z0-9_]+)`))?.[1]);
    values.push({
      appResourceType: pick('appResourceType'),
      scene: pick('scene'),
      source: pick('source'),
      uploadProfileCode: pick('uploadProfileCode'),
    });
  }
  return values;
}

test('upload declaration file exists, parses, and uses the supported schema', () => {
  const declaration = loadDeclaration();
  assert.equal(declaration.schemaVersion, 1);
  assert.ok(Array.isArray(declaration.declarations));
  assert.ok(declaration.declarations.length > 0);
});

test("upload declaration declares this application's canonical appId", () => {
  assert.equal(loadDeclaration().appId, loadCanonicalAppId());
});

test('upload declaration declares every required field on every entry', () => {
  const required = [
    'appResourceType',
    'appResourceIdKind',
    'scene',
    'source',
    'uploadProfileCode',
    'retention',
    'purpose',
  ];
  for (const entry of loadDeclaration().declarations) {
    for (const field of required) {
      assert.ok(entry[field], `entry ${entry.appResourceType} is missing ${field}`);
    }
  }
});

test('upload declaration uses standard upload profiles only', () => {
  for (const entry of loadDeclaration().declarations) {
    assert.ok(
      STANDARD_UPLOAD_PROFILES.has(entry.uploadProfileCode),
      `${entry.appResourceType} declares a non-standard profile ${entry.uploadProfileCode}`,
    );
  }
});

test('upload declaration names appResourceType as a dotted lowercase business type', () => {
  for (const entry of loadDeclaration().declarations) {
    assert.match(entry.appResourceType, APP_RESOURCE_TYPE);
  }
});

test('upload declaration names source and scene as stable lowercase kebab-case labels', () => {
  for (const entry of loadDeclaration().declarations) {
    // A package name, npm specifier, or import path is forbidden as `source`.
    assert.match(entry.source, KEBAB_CASE);
    assert.ok(!entry.source.includes('/'), `${entry.source} contains a path separator`);
    assert.ok(!entry.source.includes('@'), `${entry.source} contains an npm scope`);
    assert.match(entry.scene, KEBAB_CASE);
    assert.ok(!RESERVED_SCENES.has(entry.scene), `${entry.scene} is a reserved scene`);
  }
});

test('upload declaration declares temporary retention with an explicit TTL', () => {
  for (const entry of loadDeclaration().declarations) {
    assert.ok(['long_term', 'temporary'].includes(entry.retention));
    if (entry.retention === 'temporary') {
      assert.ok(
        (entry.retentionTtlSeconds ?? 0) > 0,
        `${entry.appResourceType} is temporary without retentionTtlSeconds`,
      );
    }
  }
});

test('upload declaration declares a distinct (appResourceType, scene, uploadProfileCode) triple per entry', () => {
  const keys = loadDeclaration().declarations.map(
    (entry) => `${entry.appResourceType}|${entry.scene}|${entry.uploadProfileCode}`,
  );
  assert.equal(new Set(keys).size, keys.length);
});

test('upload declaration constants mirror the declaration file', () => {
  const constants = readDeclaredConstantValues(fs.readFileSync(CONSTANTS_PATH, 'utf8'));
  const declared = loadDeclaration().declarations;
  assert.equal(constants.length, declared.length, 'constant count differs from declaration count');

  for (const declaredEntry of declared) {
    const constant = constants.find(
      (entry) => entry.appResourceType === declaredEntry.appResourceType,
    );
    assert.ok(constant, `no constant carries ${declaredEntry.appResourceType}`);
    for (const field of ['appResourceType', 'scene', 'source', 'uploadProfileCode']) {
      assert.equal(
        constant[field],
        declaredEntry[field],
        `constant ${field} disagrees with the declaration for ${declaredEntry.appResourceType}`,
      );
    }
  }
});

test('upload declaration constants agree on one source label', () => {
  // §18.2: one application must not ship two `source` styles for its own uploads.
  const sources = new Set(loadDeclaration().declarations.map((entry) => entry.source));
  assert.equal(sources.size, 1, `expected one source label, found ${[...sources].join(', ')}`);
});

test('upload call site imports the declaration instead of repeating literals', () => {
  // §18.3: a declared value MUST come from the declaration, not from a duplicated literal.
  const servicePath = 'packages/sdkwork-skills-pc-core/src/sdk/skillArtifactUploadService.ts';
  const file = path.join(appRoot, servicePath);
  if (!fs.existsSync(file)) {
    return;
  }
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(
    source.includes('SKILLS_PACKAGE_ARTIFACT_UPLOAD'),
    `${servicePath} does not consume the declared upload constants`,
  );
  assert.ok(
    !source.includes("'skills-pc-package-upload'") && !source.includes("'pc_local_file'"),
    `${servicePath} still contains a retired inline upload literal`,
  );
});
