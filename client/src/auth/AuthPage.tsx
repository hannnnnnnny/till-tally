import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { InlineNotice } from '../ui/StatePanel';
import { useAuth } from './AuthContext';
import { type AuthFormValues, type AuthMode } from './types';

export function AuthPage() {
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
          <InlineNotice tone="error" className="mb-4">
            {submitError}
          </InlineNotice>
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
