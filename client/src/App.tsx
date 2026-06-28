import { useState } from 'react';
import { useForm } from 'react-hook-form';

type AuthMode = 'login' | 'register';

type AuthFormValues = {
  name?: string;
  email: string;
  password: string;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
};

export default function App() {
  const [mode, setMode] = useState<AuthMode>('login');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AuthFormValues>();

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    setSubmitError(null);
    setCurrentUser(null);
    reset();
  }

  async function onSubmit(values: AuthFormValues) {
    setIsSubmitting(true);
    setSubmitError(null);
    setCurrentUser(null);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

      const body =
        mode === 'login'
          ? {
              email: values.email,
              password: values.password,
            }
          : {
              name: values.name ?? '',
              email: values.email,
              password: values.password,
            };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as Partial<AuthResponse> & {
        error?: string | { message?: string };
      };

      if (!response.ok) {
        const message =
          typeof data.error === 'string'
            ? data.error
            : (data.error?.message ?? 'Something went wrong');

        throw new Error(message);
      }

      if (!data.user || !data.accessToken) {
        throw new Error('Invalid auth response');
      }

      setCurrentUser(data.user);
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

        {currentUser && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Signed in as {currentUser.name}
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
