import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { type AuthFormValues, type AuthMode } from './auth/types';
import { createBusiness, fetchBusinesses } from './businesses/api';
import {
  type Business,
  type BusinessFormValues,
  type SalesChannel,
} from './businesses/types';

const CHANNEL_OPTIONS: Array<{ value: SalesChannel; label: string }> = [
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'TRADE_ME', label: 'Trade Me' },
  { value: 'IN_STORE', label: 'In store' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'OTHER', label: 'Other' },
];

function AuthPage() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AuthFormValues>();

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    setSubmitError(null);
    reset();
  }

  async function onSubmit(values: AuthFormValues) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await signIn(mode, values);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">TillTally</h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === 'login' ? 'Sign in to your dashboard' : 'Create your account'}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-md bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => handleModeChange('login')}
            className={`rounded px-3 py-2 text-sm font-medium ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('register')}
            className={`rounded px-3 py-2 text-sm font-medium ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Register
          </button>
        </div>

        {submitError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...register('name', {
                  required: mode === 'register' ? 'Name is required' : false,
                  maxLength: {
                    value: 120,
                    message: 'Name must be 120 characters or less',
                  },
                })}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^\S+@\S+\.\S+$/,
                  message: 'Enter a valid email',
                },
              })}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...register('password', {
                required: 'Password is required',
                minLength:
                  mode === 'register'
                    ? {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      }
                    : undefined,
              })}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting
              ? mode === 'login'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
}

function BusinessSetupForm({
  accessToken,
  onCreated,
}: {
  accessToken: string;
  onCreated: (business: Business) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BusinessFormValues>({
    defaultValues: {
      name: '',
      industry: 'Retail',
      city: '',
      channels: ['IN_STORE'],
    },
  });

  async function onSubmit(values: BusinessFormValues) {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const business = await createBusiness(accessToken, {
        name: values.name.trim(),
        industry: values.industry.trim() || null,
        city: values.city.trim() || null,
      });

      onCreated(business);
      setSuccessMessage(`${business.name} is ready`);
      reset({
        name: '',
        industry: values.industry,
        city: values.city,
        channels: values.channels,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">Workspace setup</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Create a business</h2>
      </div>

      {submitError && (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="business-name" className="block text-sm font-medium text-slate-700">
            Business name
          </label>
          <input
            id="business-name"
            type="text"
            autoComplete="organization"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            {...register('name', {
              required: 'Business name is required',
              maxLength: {
                value: 160,
                message: 'Business name must be 160 characters or less',
              },
            })}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-slate-700">
              Industry
            </label>
            <input
              id="industry"
              type="text"
              autoComplete="organization-title"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              {...register('industry', {
                maxLength: {
                  value: 80,
                  message: 'Industry must be 80 characters or less',
                },
              })}
            />
            {errors.industry && (
              <p className="mt-1 text-sm text-red-600">{errors.industry.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-slate-700">
              City
            </label>
            <input
              id="city"
              type="text"
              autoComplete="address-level2"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              {...register('city', {
                maxLength: {
                  value: 80,
                  message: 'City must be 80 characters or less',
                },
              })}
            />
            {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Sales channels</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CHANNEL_OPTIONS.map((channel) => (
              <label
                key={channel.value}
                className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  value={channel.value}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  {...register('channels', {
                    validate: (value) =>
                      value.length > 0 || 'Select at least one sales channel',
                  })}
                />
                {channel.label}
              </label>
            ))}
          </div>
          {errors.channels && (
            <p className="mt-1 text-sm text-red-600">{errors.channels.message}</p>
          )}
        </fieldset>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? 'Creating business...' : 'Create business'}
        </button>
      </form>
    </section>
  );
}

function DashboardShell() {
  const { accessToken, user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(true);
  const [businessError, setBusinessError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const token = accessToken;
    let isActive = true;

    async function loadBusinesses() {
      setIsLoadingBusinesses(true);
      setBusinessError(null);

      try {
        const nextBusinesses = await fetchBusinesses(token);

        if (!isActive) {
          return;
        }

        setBusinesses(nextBusinesses);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setBusinessError(error instanceof Error ? error.message : 'Something went wrong');
      } finally {
        if (isActive) {
          setIsLoadingBusinesses(false);
        }
      }
    }

    void loadBusinesses();

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleBusinessCreated(business: Business) {
    setBusinesses((currentBusinesses) => [business, ...currentBusinesses]);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Signed in as</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{user?.name}</h1>
            <p className="mt-1 text-sm text-slate-600">{user?.email}</p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          {accessToken && (
            <BusinessSetupForm accessToken={accessToken} onCreated={handleBusinessCreated} />
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-500">Workspaces</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Your businesses</h2>
            </div>

            {isLoadingBusinesses && (
              <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Loading businesses...
              </div>
            )}

            {businessError && (
              <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {businessError}
              </div>
            )}

            {!isLoadingBusinesses && !businessError && businesses.length === 0 && (
              <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                No businesses yet.
              </div>
            )}

            {businesses.length > 0 && (
              <div className="mt-6 space-y-3">
                {businesses.map((business) => (
                  <div
                    key={business.id}
                    className="rounded-md border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{business.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {[business.industry, business.city].filter(Boolean).join(' / ') ||
                            'Workspace'}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {business.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <ProtectedRoute fallback={<AuthPage />}>
      <DashboardShell />
    </ProtectedRoute>
  );
}
