import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldBypassBetaAuthWhenKvUnavailable } from '../src/lib/betaBinding.ts';

const withEnv = (overrides, run) => {
  const keys = Object.keys(overrides);
  const snapshot = new Map(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of snapshot.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test('dev com flag ativa bypass quando KV não está configurado', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      VERCEL_ENV: undefined,
      APP_ENV: undefined,
      ENVIRONMENT: undefined,
      BETA_AUTH_DEV_BYPASS: '1',
      KV_REST_API_URL: undefined,
      KV_REST_API_TOKEN: undefined
    },
    () => {
      assert.equal(shouldBypassBetaAuthWhenKvUnavailable(), true);
    }
  );
});

test('sem flag não ativa bypass mesmo em desenvolvimento', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      VERCEL_ENV: undefined,
      APP_ENV: undefined,
      ENVIRONMENT: undefined,
      BETA_AUTH_DEV_BYPASS: undefined,
      KV_REST_API_URL: undefined,
      KV_REST_API_TOKEN: undefined
    },
    () => {
      assert.equal(shouldBypassBetaAuthWhenKvUnavailable(), false);
    }
  );
});

test('produção com flag nunca ativa bypass (fail-safe)', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      APP_ENV: undefined,
      ENVIRONMENT: undefined,
      BETA_AUTH_DEV_BYPASS: 'true',
      KV_REST_API_URL: undefined,
      KV_REST_API_TOKEN: undefined
    },
    () => {
      assert.equal(shouldBypassBetaAuthWhenKvUnavailable(), false);
    }
  );
});

test('staging com flag nunca ativa bypass (fail-safe)', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      VERCEL_ENV: undefined,
      APP_ENV: 'staging',
      ENVIRONMENT: undefined,
      BETA_AUTH_DEV_BYPASS: 'true',
      KV_REST_API_URL: undefined,
      KV_REST_API_TOKEN: undefined
    },
    () => {
      assert.equal(shouldBypassBetaAuthWhenKvUnavailable(), false);
    }
  );
});

test('não interfere no fluxo real quando KV está configurado (mesmo com flag)', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      VERCEL_ENV: undefined,
      APP_ENV: undefined,
      ENVIRONMENT: undefined,
      BETA_AUTH_DEV_BYPASS: '1',
      KV_REST_API_URL: 'https://kv.local',
      KV_REST_API_TOKEN: 'token'
    },
    () => {
      assert.equal(shouldBypassBetaAuthWhenKvUnavailable(), false);
    }
  );
});
