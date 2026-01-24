export function requireAdmin(req: Request) {
  const headerKey = req.headers.get("x-admin-key") ?? "";
  const adminKey = process.env.ADMIN_KEY ?? "";
  return Boolean(adminKey && headerKey === adminKey);
}
