#!/usr/bin/env node
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const HARD_CODED = [
  { code: "PLANTAO-OWNER-2027", label: "Owner" },
  { code: "ANTAO-OWNER-2027", label: "Owner (deprecated, remove after 2026-02-01)" }
];

function usage() {
  console.log(`Usage:
  node scripts/invites.mjs create <label> <days>
  node scripts/invites.mjs list
  node scripts/invites.mjs revoke <code>

Env:
  ADMIN_KEY   (required)
  BASE_URL    (default: ${BASE_URL})
`);
}

async function request(path, options = {}) {
  if (!ADMIN_KEY) {
    console.error("Missing ADMIN_KEY env.");
    process.exit(1);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Request failed (${res.status}):`, data);
    process.exit(1);
  }
  return data;
}

async function create(label, days) {
  if (!label || !days || Number.isNaN(Number(days))) {
    usage();
    process.exit(1);
  }
  const daysValid = Number(days);
  const data = await request("/api/admin/invites/create", {
    method: "POST",
    body: JSON.stringify({ label, daysValid })
  });
  console.log("Invite created:");
  console.log(`  code: ${data.code}`);
  console.log(`  label: ${data.label}`);
  console.log(`  expiresAt: ${data.expiresAt}`);
  console.log(`  link: ${BASE_URL}/?code=${encodeURIComponent(data.code)}`);
}

async function list() {
  const data = await request("/api/admin/invites/list");
  const invites = Array.isArray(data.invites) ? data.invites : [];
  console.log("HARD-CODED:");
  console.table(HARD_CODED);
  if (!invites.length) {
    console.log("No KV invites found.");
    return;
  }
  console.table(
    invites.map((i) => ({
      code: i.code,
      label: i.label,
      expiresAt: i.expiresAt,
      revoked: Boolean(i.revoked)
    }))
  );
}

async function revoke(code) {
  if (!code) {
    usage();
    process.exit(1);
  }
  const data = await request("/api/admin/invites/revoke", {
    method: "POST",
    body: JSON.stringify({ code })
  });
  if (data.ok) {
    console.log(`Revoked ${code}`);
  } else {
    console.log("Failed:", data);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    usage();
    process.exit(1);
  }
  if (cmd === "create") {
    const [label, days] = rest;
    await create(label, days);
  } else if (cmd === "list") {
    await list();
  } else if (cmd === "revoke") {
    const [code] = rest;
    await revoke(code);
  } else {
    usage();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
