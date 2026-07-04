import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useBusinesses } from '../businesses/BusinessContext';
import { APP_NAV_ITEMS, getRouteTitle } from '../navigation/routes';
import { InlineNotice } from '../ui/StatePanel';

export function AppShell() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { activeBusiness, businesses } = useBusinesses();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pageTitle = getRouteTitle(location.pathname);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
      >
        Skip to main content
      </a>

      <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-950">TillTally</p>
            <p className="truncate text-xs font-medium text-slate-500">Retail analytics</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary">
          {APP_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`
              }
            >
              <span className="block">{item.label}</span>
              <span className="mt-0.5 block text-xs opacity-70">{item.description}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-5 py-4">
          <p className="text-xs font-medium text-slate-500">Signed in as</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{user?.name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-col gap-3 px-3 py-3 min-[375px]:px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-xl lg:hidden" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-500">
                  {activeBusiness?.name ?? 'No active workspace'}
                </p>
                <h1 className="truncate text-xl font-bold text-slate-950">{pageTitle}</h1>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
              <BusinessSelector />
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 sm:w-auto"
              >
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </header>

        {activeBusiness && (
          <section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Active workspace</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{activeBusiness.name}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {[activeBusiness.industry, activeBusiness.city].filter(Boolean).join(' / ') ||
                    'Workspace'}
                </p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {activeBusiness.role}
              </span>
            </div>
          </section>
        )}

        {!activeBusiness && businesses.length === 0 && (
          <section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <InlineNotice tone="warning" className="mx-auto max-w-7xl">
              Create a business to unlock workspace data.
            </InlineNotice>
          </section>
        )}

        <main
          id="main-content"
          className="mx-auto max-w-7xl px-3 py-5 pb-28 min-[375px]:px-4 sm:px-6 sm:py-6 lg:px-8"
        >
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 gap-1 border-t border-slate-200 bg-white px-1.5 py-2 shadow-lg min-[375px]:px-2 sm:grid-cols-6 lg:hidden"
        aria-label="Primary"
      >
        {APP_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              `rounded-md px-2 py-2 text-center text-xs font-medium ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
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
    <div className="w-full min-w-0 sm:w-64">
      <label htmlFor="active-business" className="block text-sm font-medium text-slate-700">
        Active business
      </label>
      <select
        id="active-business"
        value={activeBusinessId ?? ''}
        onChange={(event) => setActiveBusinessId(event.target.value)}
        disabled={status === 'loading'}
        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {businesses.map((business) => (
          <option key={business.id} value={business.id}>
            {business.name}
          </option>
        ))}
      </select>
    </div>
  );
}
