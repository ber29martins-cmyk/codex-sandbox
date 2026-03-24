import test from "node:test";
import assert from "node:assert/strict";
import {
  betaSessionMaxAgeSeconds,
  decodeBetaSession,
  encodeBetaSession,
  shouldUseSecureCookies
} from "../src/lib/betaSession.ts";

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

test("cookie seguro: development local não força secure", () => {
  withEnv(
    {
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      APP_ENV: undefined,
      ENVIRONMENT: undefined
    },
    () => {
      assert.equal(shouldUseSecureCookies(), false);
    }
  );
});

test("cookie seguro: preview/prod/staging força secure", () => {
  withEnv(
    {
      NODE_ENV: "development",
      VERCEL_ENV: "preview",
      APP_ENV: undefined,
      ENVIRONMENT: undefined
    },
    () => {
      assert.equal(shouldUseSecureCookies(), true);
    }
  );

  withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: undefined,
      APP_ENV: undefined,
      ENVIRONMENT: undefined
    },
    () => {
      assert.equal(shouldUseSecureCookies(), true);
    }
  );

  withEnv(
    {
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      APP_ENV: "staging",
      ENVIRONMENT: undefined
    },
    () => {
      assert.equal(shouldUseSecureCookies(), true);
    }
  );
});

test("expiração: remember usa TTL maior e payload mantém dados", () => {
  assert.equal(betaSessionMaxAgeSeconds(false), 8 * 60 * 60);
  assert.equal(betaSessionMaxAgeSeconds(true), 24 * 60 * 60);

  const token = encodeBetaSession({
    code: "ABC-123",
    emailHash: "hash-1",
    label: "unit",
    remember: true
  });
  const payload = decodeBetaSession(token);
  assert.ok(payload);
  assert.equal(payload.code, "ABC-123");
  assert.equal(payload.emailHash, "hash-1");
  assert.equal(payload.remember, true);
  assert.ok(payload.exp > Date.now());
});
