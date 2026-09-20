import {
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import Input
  from '../components/common/Input';

import Button
  from '../components/common/Button';

import {
  useAuth,
} from '../features/auth/AuthContext';

export default function Register() {
  const navigate =
    useNavigate();

  const {
    register,
  } = useAuth();

  const [
    form,
    setForm,
  ] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  const [
    error,
    setError,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const handleChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      setForm(
        (previous) => ({
          ...previous,
          [name]:
            value,
        })
      );
    };

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      setLoading(true);
      setError('');

      try {
        await register({
          name:
            form.name.trim(),

          email:
            form.email
              .trim()
              .toLowerCase(),

          phone:
            form.phone.trim() ||
            undefined,

          password:
            form.password,
        });

        navigate(
          `/verify-email?email=${encodeURIComponent(
            form.email
              .trim()
              .toLowerCase()
          )}`,
          {
            replace:
              true,
          }
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not create your account.'
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-card border border-hairline bg-white p-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
          Athenaeum
        </p>

        <h1 className="mt-3 font-serif text-2xl font-semibold text-ink">
          Create your account
        </h1>

        <p className="mt-2 text-sm text-ink-muted">
          You will need to verify your email before accessing the library.
        </p>

        {error && (
          <div className="mt-5 rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
            {error}
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
          className="mt-6 space-y-4"
        >
          <Input
            id="name"
            name="name"
            label="Full name"
            value={
              form.name
            }
            onChange={
              handleChange
            }
            required
          />

          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            value={
              form.email
            }
            onChange={
              handleChange
            }
            required
          />

          <Input
            id="phone"
            name="phone"
            label="Phone (optional)"
            value={
              form.phone
            }
            onChange={
              handleChange
            }
          />

          <div className="relative">
            <Input
              id="password"
              name="password"
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              label="Password"
              value={
                form.password
              }
              onChange={
                handleChange
              }
              required
              className="pr-11"
            />

            <button
              type="button"
              onClick={
                () =>
                  setShowPassword(
                    (previous) =>
                      !previous
                  )
              }
              className="absolute bottom-2.5 right-3 flex items-center justify-center text-ink-muted transition hover:text-ink"
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
            >
              {showPassword ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                  <path d="M9.9 4.2A10.7 10.7 0 0112 4c5 0 9 4 10 8a11.8 11.8 0 01-2.1 4.2" />
                  <path d="M6.6 6.6C4.4 8 2.8 10 2 12c1 4 5 8 10 8a10.7 10.7 0 005.4-1.5" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                  />
                </svg>
              )}
            </button>
          </div>

          <Button
            type="submit"
            disabled={
              loading
            }
            className="w-full"
          >
            {loading
              ? 'Creating account…'
              : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-muted">
          Already verified?{' '}

          <Link
            to="/login"
            className="font-medium text-brass hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}