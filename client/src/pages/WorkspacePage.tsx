import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../auth/AuthContext';
import { createBusiness } from '../businesses/api';
import { useBusinesses } from '../businesses/BusinessContext';
import { type BusinessFormValues, type SalesChannel } from '../businesses/types';
import { InlineNotice, StatePanel } from '../ui/StatePanel';

const CHANNEL_OPTIONS: Array<{ value: SalesChannel; label: string }> = [
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'TRADE_ME', label: 'Trade Me' },
  { value: 'IN_STORE', label: 'In store' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'OTHER', label: 'Other' },
];

export function WorkspacePage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <BusinessSetupForm />
      <BusinessList />
    </div>
  );
}

function BusinessSetupForm() {
  const { accessToken } = useAuth();
  const { addBusiness } = useBusinesses();
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
    if (!accessToken) {
      setSubmitError('Missing authenticated session');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const business = await createBusiness(accessToken, {
        name: values.name.trim(),
        industry: values.industry.trim() || null,
        city: values.city.trim() || null,
      });

      addBusiness(business);
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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Workspace setup</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Create a business</h2>
      </div>

      {submitError && (
        <InlineNotice tone="error" className="mt-5">
          {submitError}
        </InlineNotice>
      )}

      {successMessage && (
        <InlineNotice tone="success" className="mt-5">
          {successMessage}
        </InlineNotice>
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
                    validate: (value) => value.length > 0 || 'Select at least one sales channel',
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

function BusinessList() {
  const {
    activeBusinessId,
    businesses,
    error: businessError,
    setActiveBusinessId,
    status: businessStatus,
  } = useBusinesses();
  const isLoadingBusinesses = businessStatus === 'loading';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Workspaces</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Your businesses</h2>
      </div>

      {isLoadingBusinesses && (
        <StatePanel
          tone="loading"
          className="mt-6"
          minHeight="sm"
          message="Loading businesses..."
        />
      )}

      {businessError && (
        <InlineNotice tone="error" className="mt-6">
          {businessError}
        </InlineNotice>
      )}

      {!isLoadingBusinesses && !businessError && businesses.length === 0 && (
        <StatePanel className="mt-6" minHeight="sm" message="No businesses yet." />
      )}

      {businesses.length > 0 && (
        <div className="mt-6 space-y-3">
          {businesses.map((business) => {
            const isActiveBusiness = business.id === activeBusinessId;

            return (
              <div
                key={business.id}
                className={`rounded-md border px-4 py-3 ${
                  isActiveBusiness ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'
                }`}
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
                {!isActiveBusiness && (
                  <button
                    type="button"
                    onClick={() => setActiveBusinessId(business.id)}
                    className="mt-3 text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                  >
                    Set active
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
