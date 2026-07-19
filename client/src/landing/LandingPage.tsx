import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getDemoInfo } from '../config/demoInfo';
import { runtimeConfig } from '../config/runtime';
import {
  ANALYTICS_METHODS,
  DEMO_LOGIN,
  LANDING_FEATURES,
  LANDING_NAV_ITEMS,
  TECH_STACK_ITEMS,
} from './content';

const HERO_METRICS = [
  { label: 'Revenue', value: '$84.2k', change: '+12.4%' },
  { label: 'Gross margin', value: '42.8%', change: '+3.1%' },
  { label: 'Orders', value: '1,284', change: '+8.7%' },
  { label: 'AOV', value: '$65.60', change: '+4.2%' },
];

const CHANNELS = [
  { label: 'Shopify', value: '$42.8k' },
  { label: 'In store', value: '$24.1k' },
  { label: 'Trade Me', value: '$11.7k' },
  { label: 'Social', value: '$5.6k' },
];

const PREVIEW_PRODUCTS = [
  { name: 'Premium Hoodie', status: 'Best seller', revenue: '$18.4k' },
  { name: 'Everyday Tote', status: 'High margin', revenue: '$11.2k' },
  { name: 'Classic Cap', status: 'Low stock', revenue: '$7.8k' },
];

export function LandingPage() {
  const { signIn, status } = useAuth();
  const navigate = useNavigate();
  const [demoEntryBusy, setDemoEntryBusy] = useState(false);
  const isAuthenticated = status === 'authenticated';
  const demoInfo = runtimeConfig.isDemo ? getDemoInfo() : null;
  const primaryTarget = isAuthenticated
    ? '/dashboard'
    : runtimeConfig.isStaticPreview
      ? '#preview'
      : '/auth';
  const primaryLabel = isAuthenticated
    ? 'Open dashboard'
    : demoInfo
      ? 'Try the live demo'
      : runtimeConfig.isStaticPreview
        ? 'Explore the preview'
        : 'Try demo login';
  const enterDemo =
    demoInfo && !isAuthenticated
      ? async () => {
          if (demoEntryBusy) return;
          setDemoEntryBusy(true);

          try {
            await signIn('login', {
              email: demoInfo.credentials.email,
              password: demoInfo.credentials.password,
            });
            navigate('/dashboard');
          } catch {
            // The pre-filled auth page is the fallback entrance.
            navigate('/auth');
          } finally {
            setDemoEntryBusy(false);
          }
        }
      : undefined;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <LandingNav
        primaryTarget={primaryTarget}
        primaryLabel={primaryLabel}
        onPrimaryAction={enterDemo}
      />

<section className="relative isolate flex min-h-[68dvh] items-center overflow-hidden bg-slate-50 px-4 pt-16 dark:bg-slate-950 sm:px-6 lg:px-8">
  <div className="mx-auto w-full max-w-4xl py-20 text-center">
    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
      Retail analytics for small businesses
    </p>

    <h1 className="mt-5 text-5xl font-black leading-[0.98] text-slate-950 sm:text-6xl lg:text-7xl dark:text-white">
      TillTally
    </h1>

    <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg dark:text-slate-200">
      Turn messy sales CSVs into clear decisions for revenue, margin, products, and inventory.
    </p>

    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
      <PrimaryAction
        target={primaryTarget}
        onActivate={enterDemo}
        className="inline-flex h-11 items-center justify-center rounded-md bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 transition hover:bg-blue-800 active:translate-y-px"
      >
        {primaryLabel}
      </PrimaryAction>

      <a
        href="#preview"
        className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white/80 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white active:translate-y-px dark:border-slate-600 dark:bg-slate-900/75 dark:text-white dark:hover:bg-slate-900"
      >
        View dashboard preview
      </a>
    </div>
  </div>
</section>
          </div>
        </div>
      </section>

      <main>
        <FeaturesSection />
        <PreviewSection />
        <MethodsSection />
        <StackSection />
        <DemoLoginSection />
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={runtimeConfig.assetUrl('favicon.svg')}
              alt=""
              className="h-8 w-8 rounded-lg"
            />
            <span className="font-semibold text-slate-900 dark:text-white">TillTally</span>
          </div>
          <p>Retail analytics dashboard for CSV-first small retailers.</p>
        </div>
      </footer>
    </div>
  );
}

function LandingNav({
  primaryTarget,
  primaryLabel,
  onPrimaryAction,
}: {
  primaryTarget: string;
  primaryLabel: string;
  onPrimaryAction?: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 sm:gap-3"
          aria-label="TillTally home"
        >
          <img src={runtimeConfig.assetUrl('favicon.svg')} alt="" className="h-9 w-9 rounded-xl" />
          <span className="truncate text-base font-black text-slate-950 sm:text-lg dark:text-white">
            TillTally
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Landing">
          {LANDING_NAV_ITEMS.map((item) => (
            <SectionAction
              key={item.href}
              target={item.href}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
            >
              {runtimeConfig.isStaticPreview && item.href === '#demo-login'
                ? 'Deployment'
                : item.label}
            </SectionAction>
          ))}
        </nav>

        <PrimaryAction
          target={primaryTarget}
          onActivate={onPrimaryAction}
          className="hidden h-10 shrink-0 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:inline-flex"
        >
          {primaryLabel}
        </PrimaryAction>
      </div>
    </header>
  );
}

function FeaturesSection() {
  return (
    <section
      id="features"
      className="border-y border-slate-200 bg-white px-4 py-20 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
            From CSV upload to retail decisions.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
            TillTally focuses on the store owner workflow: upload data, validate it, understand the
            numbers, and act on inventory risk.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-[1.15fr_0.85fr]">
          {LANDING_FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className={`rounded-lg border p-6 ${
                index === 0
                  ? 'border-blue-200 bg-blue-50 dark:border-blue-900/70 dark:bg-blue-950/40'
                  : index === 1
                    ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                    : index === 2
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
              }`}
            >
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreviewSection() {
  return (
    <section id="preview" className="bg-slate-50 px-4 py-20 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
            A dashboard built for retail operators.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
            The product view keeps the core operating questions visible: what sold, what made
            margin, and what needs action next.
          </p>
        </div>

        <div className="mt-10">
          <HeroDashboardPreview />
        </div>
      </div>
    </section>
  );
}

function MethodsSection() {
  return (
    <section
      id="methods"
      className="border-y border-slate-200 bg-white px-4 py-20 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <h2 className="text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
            Analytics that map to real store decisions.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
            The backend services turn orders, products, costs, and inventory snapshots into
            explainable retail signals.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {ANALYTICS_METHODS.map((method) => (
            <article
              key={method.title}
              className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="text-lg font-bold text-slate-950 dark:text-white">{method.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {method.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StackSection() {
  return (
    <section id="stack" className="bg-slate-50 px-4 py-20 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
            Built like a real full-stack product.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
            The stack shows practical engineering choices for auth, data isolation, imports,
            analytics services, and local deployment.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TECH_STACK_ITEMS.map((item) => (
            <article
              key={item.name}
              className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-lg font-black text-blue-700 dark:text-blue-300">{item.name}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoLoginSection() {
  const isStaticPreview = runtimeConfig.isStaticPreview;

  return (
    <section
      id="demo-login"
      className="border-t border-slate-200 bg-white px-4 py-20 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-7xl gap-8 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/70 dark:bg-blue-950/30 lg:grid-cols-[1fr_0.9fr] lg:p-8">
        <div>
          <h2 className="text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
            Demo data is ready to inspect.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-200">
            {isStaticPreview
              ? 'This GitHub Pages build is a frontend preview. Authentication, imports, and live analytics are available in the full Docker deployment.'
              : 'Seed data creates a demo owner and retail workspace so the dashboard can be reviewed without manual setup.'}
          </p>
          {isStaticPreview ? (
            <a
              href="https://github.com/hannnnnnnny/till-tally/blob/main/docs/DEPLOYMENT.md"
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 active:translate-y-px"
            >
              View deployment guide
            </a>
          ) : (
            <Link
              to="/auth"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 active:translate-y-px"
            >
              Go to login
            </Link>
          )}
        </div>

        <div className="rounded-lg border border-blue-200 bg-white p-5 dark:border-blue-900/70 dark:bg-slate-950">
          {isStaticPreview ? (
            <>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Static preview
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
                No backend or customer data is connected to this public Pages build.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Demo login</p>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Email
                  </dt>
                  <dd className="mt-1 rounded-md bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900 dark:bg-slate-900 dark:text-white">
                    {DEMO_LOGIN.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Password
                  </dt>
                  <dd className="mt-1 rounded-md bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900 dark:bg-slate-900 dark:text-white">
                    {DEMO_LOGIN.password}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function PrimaryAction({
  target,
  className,
  children,
  onActivate,
}: {
  target: string;
  className: string;
  children: ReactNode;
  onActivate?: () => void;
}) {
  if (onActivate) {
    return (
      <button type="button" className={className} onClick={onActivate}>
        {children}
      </button>
    );
  }

  if (target.startsWith('#')) {
    return (
      <SectionAction target={target} className={className}>
        {children}
      </SectionAction>
    );
  }

  return (
    <Link to={target} className={className}>
      {children}
    </Link>
  );
}

function SectionAction({
  target,
  className,
  children,
}: {
  target: string;
  className: string;
  children: ReactNode;
}) {
  if (!runtimeConfig.isStaticPreview) {
    return (
      <a href={target} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        document.getElementById(target.slice(1))?.scrollIntoView({ behavior: 'smooth' })
      }
    >
      {children}
    </button>
  );
}

function HeroDashboardPreview() {
  return (
    <div className="max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">TillTally</p>
          <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
            Auckland Demo Retail
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white">
            OWNER
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sample data</p>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {HERO_METRICS.map((metric) => (
              <div
                key={metric.label}
                className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {metric.label}
                </p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-xl font-black text-slate-950 sm:text-2xl dark:text-white">
                    {metric.value}
                  </p>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {metric.change}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-950 dark:text-white">Sales trend</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">30 days</p>
            </div>
            <div className="mt-5 flex h-40 items-end gap-2">
              {[42, 58, 46, 72, 68, 88, 64, 96, 82, 108, 92, 118].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t bg-blue-700/80 dark:bg-blue-400/80"
                  style={{ height }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-bold text-slate-950 dark:text-white">Channel revenue</p>
            <div className="mt-4 space-y-3">
              {CHANNELS.map((channel) => (
                <div key={channel.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {channel.label}
                  </span>
                  <span className="font-mono text-sm font-semibold text-slate-950 dark:text-white">
                    {channel.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-bold text-slate-950 dark:text-white">Product signals</p>
            <div className="mt-4 space-y-3">
              {PREVIEW_PRODUCTS.map((product) => (
                <div
                  key={product.name}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {product.name}
                    </p>
                    <p className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {product.revenue}
                    </p>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {product.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
