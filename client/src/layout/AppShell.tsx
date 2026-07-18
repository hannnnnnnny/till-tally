import {
  BarChart3,
  Building2,
  FileChartColumn,
  Ellipsis,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  PackageSearch,
  Settings2,
  Upload,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useBusinesses } from '../businesses/BusinessContext';
import {
  APP_NAV_ITEMS,
  MOBILE_MORE_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  type AppRouteId,
  getRouteTitle,
} from '../navigation/routes';
import { getActionClassName } from '../ui/layout';
import { InlineNotice } from '../ui/StatePanel';

const NAV_ICONS: Record<AppRouteId, LucideIcon> = {
  analytics: MessageSquareText,
  channels: BarChart3,
  dashboard: LayoutDashboard,
  imports: Upload,
  inventory: Warehouse,
  products: PackageSearch,
  reports: FileChartColumn,
  workspace: Settings2,
};

export function AppShell() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { activeBusiness, businesses } = useBusinesses();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const pageTitle = getRouteTitle(location.pathname);
  const isMoreRouteActive = MOBILE_MORE_NAV_ITEMS.some((item) =>
    location.pathname.startsWith(item.path),
  );

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const firstLink = mobileMenuRef.current?.querySelector<HTMLAnchorElement>('a');
    const focusFrame = window.requestAnimationFrame(() => firstLink?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        moreButtonRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!mobileMenuRef.current?.contains(target) && !moreButtonRef.current?.contains(target)) {
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMobileMenuOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <aside className="hidden border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-lg" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-950">TillTally</p>
            <p className="truncate text-xs font-medium text-slate-500">Retail intelligence</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 text-xs font-semibold text-slate-400">Workspace</p>
          <nav className="mt-2 space-y-1" aria-label="Primary">
            {APP_NAV_ITEMS.map((item) => {
              const Icon = NAV_ICONS[item.id];

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  title={item.description}
                  className={({ isActive }) =>
                    `group flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                      isActive
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                    }`
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className="h-[18px] w-[18px] shrink-0"
                    strokeWidth={1.8}
                  />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-bold text-slate-700">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-[1536px] flex-col gap-3 px-3 py-3 min-[375px]:px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-lg lg:hidden" />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-600">
                  <Building2
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.8}
                  />
                  <span className="truncate">{getBusinessContext(activeBusiness)}</span>
                  {activeBusiness && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {activeBusiness.role}
                    </span>
                  )}
                </div>
                <h1 className="truncate text-xl font-bold text-slate-950">{pageTitle}</h1>
              </div>
            </div>

            <div className="flex w-full items-end gap-2 sm:w-auto">
              <BusinessSelector />
              <button
                type="button"
                aria-label={isSigningOut ? 'Signing out' : 'Sign out'}
                onClick={handleSignOut}
                disabled={isSigningOut}
                className={getActionClassName('secondary', 'shrink-0')}
              >
                <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                <span className="hidden min-[430px]:inline">
                  {isSigningOut ? 'Signing out...' : 'Sign out'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {!activeBusiness && businesses.length === 0 && (
          <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
            <InlineNotice tone="warning" className="mx-auto max-w-[1536px]">
              Create a business to unlock workspace data.
            </InlineNotice>
          </div>
        )}

        <main
          id="main-content"
          className="mx-auto max-w-[1536px] px-3 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] min-[375px]:px-4 sm:px-6 sm:py-7 lg:px-8 lg:pb-8"
        >
          <Outlet />
        </main>
      </div>

      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-more-menu"
          className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 rounded-lg border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/20 sm:left-auto sm:right-4 sm:w-80 lg:hidden"
          aria-label="More destinations"
        >
          <div className="px-3 pb-2 pt-1">
            <p className="text-xs font-semibold uppercase text-slate-500">More</p>
            <p className="mt-0.5 text-sm text-slate-600">Analysis, reports, and workspace</p>
          </div>
          <nav className="space-y-1" aria-label="More destinations">
            {MOBILE_MORE_NAV_ITEMS.map((item) => {
              const Icon = NAV_ICONS[item.id];

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset ${
                      isActive
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    }`
                  }
                >
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    <span className="block truncate text-xs font-normal opacity-70">
                      {item.description}
                    </span>
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-t border-slate-200 bg-white px-1.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] min-[375px]:px-2 lg:hidden"
        aria-label="Primary"
      >
        {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.id];

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              <span className="w-full truncate">{item.label}</span>
            </NavLink>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          aria-controls="mobile-more-menu"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
          className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
            isMobileMenuOpen || isMoreRouteActive
              ? 'bg-slate-950 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Ellipsis aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

function BusinessSelector() {
  const { activeBusinessId, businesses, setActiveBusinessId, status } = useBusinesses();

  if (businesses.length === 0) {
    return null;
  }

  return (
    <label className="min-w-0 flex-1 sm:w-56 sm:flex-none">
      <span className="sr-only">Active business</span>
      <select
        value={activeBusinessId ?? ''}
        onChange={(event) => setActiveBusinessId(event.target.value)}
        disabled={status === 'loading'}
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {businesses.map((business) => (
          <option key={business.id} value={business.id}>
            {business.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function getBusinessContext(business: ReturnType<typeof useBusinesses>['activeBusiness']): string {
  if (!business) {
    return 'No active business';
  }

  const details = [business.industry, business.city].filter(Boolean).join(' / ');
  return details ? `${business.name} - ${details}` : business.name;
}

function getInitials(name: string | undefined): string {
  if (!name) {
    return 'TT';
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
