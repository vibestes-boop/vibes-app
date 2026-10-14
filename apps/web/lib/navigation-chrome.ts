/** Focused tools provide their own navigation; tabs would cover their controls. */
export function isFocusedPage(pathname: string): boolean {
  return pathname === '/create' || pathname.startsWith('/messages/') ||
    pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname === '/live/host' || pathname.startsWith('/live/host/');
}

/** Controls on full-screen media need their own high-contrast treatment. */
export function usesMediaChrome(pathname: string): boolean {
  return pathname === '/' || pathname === '/following' || pathname === '/friends' ||
    pathname.startsWith('/p/') || pathname.startsWith('/live/');
}
