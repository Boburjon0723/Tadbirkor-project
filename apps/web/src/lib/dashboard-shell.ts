/** Ombor mobil to‘liq ekran sahifalari — pastki nav va header yashirin */
export function isWarehouseMobileShellPath(pathname: string): boolean {
  return (
    pathname === '/dashboard/warehouse-intake' ||
    pathname.startsWith('/dashboard/warehouse-intake/') ||
    /^\/dashboard\/picking\/[^/]+$/.test(pathname) ||
    /^\/dashboard\/inventory-count\/[^/]+$/.test(pathname)
  );
}
