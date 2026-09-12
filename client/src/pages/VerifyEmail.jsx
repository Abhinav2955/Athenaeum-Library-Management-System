import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import Button
  from '../components/common/Button';

import {
  resendVerification,
} from '../api/auth.api';

import {
  useAuth,
} from '../features/auth/AuthContext';

const RESEND_SECONDS = 60;

export default function VerifyEmail() {
  const [
    searchParams,
  ] =
    useSearchParams();

  const navigate =
    useNavigate();

  const {
    verifyAndLogin,
  } = useAuth();

  const token =
    searchParams.get(
      'token'
    );

  const email =
    searchParams.get(
      'email'
    ) || '';

  const [
    state,
    setState,
  ] = useState(
    token
      ? 'verifying'
      : 'waiting'
  );

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  const [
    resendSeconds,
    setResendSeconds,
  ] = useState(
    email
      ? RESEND_SECONDS
      : 0
  );

  const [
    resending,
    setResending,
  ] = useState(false);

  
  useEffect(() => {
    if (
      resendSeconds <= 0
    ) {
      return undefined;
    }

    const timer =
      window.setInterval(
        () => {
          setResendSeconds(
            (current) =>
              Math.max(
                0,
                current - 1
              )
          );
        },
        1000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    resendSeconds,
  ]);

 
  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled =
      false;

    const verify =
      async () => {
        setState(
          'verifying'
        );

        setError('');

        try {
          await verifyAndLogin(
            token
          );

          if (
            cancelled
          ) {
            return;
          }

          setState(
            'success'
          );

          setMessage(
            'Email verified. Signing you in…'
          );

          window.setTimeout(
            () => {
              navigate(
                '/dashboard',
                {
                  replace:
                    true,
                }
              );
            },
            700
          );
        } catch (err) {
          if (
            cancelled
          ) {
            return;
          }

          setState(
            'error'
          );

          setError(
            err.response?.data
              ?.message ||
            'The verification link is invalid or has expired.'
          );
        }
      };

    verify();

    return () => {
      cancelled =
        true;
    };
  }, [
    token,
    verifyAndLogin,
    navigate,
  ]);

  const handleResend =
    async () => {
      if (
        !email ||
        resending ||
        resendSeconds > 0
      ) {
        return;
      }

      setResending(true);
      setError('');
      setMessage('');

      try {
        const response =
          await resendVerification(
            email
          );

        setMessage(
          response.message ||
          'If the account is still unverified, a new verification email has been sent.'
        );

        setResendSeconds(
          RESEND_SECONDS
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
          'Could not resend verification email.'
        );

        if (
          err.response?.status ===
          429
        ) {
          setResendSeconds(
            RESEND_SECONDS
          );
        }
      } finally {
        setResending(false);
      }
    };

  if (
    state ===
    'verifying'
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md rounded-card border border-hairline bg-white p-7 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
            Athenaeum
          </p>

          <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">
            Verifying your email
          </h1>

          <p className="mt-3 text-sm text-ink-muted">
            Please wait while we confirm your verification link.
          </p>
        </div>
      </main>
    );
  }

  if (
    state ===
    'success'
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md rounded-card border border-status-success bg-white p-7 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-status-success">
            Verified
          </p>

          <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">
            Email verified
          </h1>

          <p className="mt-3 text-sm text-ink-muted">
            {message}
          </p>
        </div>
      </main>
    );
  }

  if (
    token &&
    state ===
      'error'
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md rounded-card border border-status-danger bg-white p-7 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-status-danger">
            Verification failed
          </p>

          <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">
            Could not verify email
          </h1>

          <p className="mt-3 text-sm text-status-danger">
            {error}
          </p>

          <Link
            to="/login"
            className="mt-5 inline-block text-sm font-medium text-brass hover:underline"
          >
            Return to sign in
          </Link>
        </div>
      </main>
    );
  }

 
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-card border border-hairline bg-white p-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
          Athenaeum
        </p>

        <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">
          Verify your email
        </h1>

        <p className="mt-3 text-sm text-ink-muted">
          Your account has been created, but you cannot access the library until your email is verified.
        </p>

        {email && (
          <div className="mt-5 rounded-card bg-paper p-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              Verification sent to
            </p>

            <p className="mt-1 break-all text-sm font-medium text-ink">
              {email}
            </p>
          </div>
        )}

        <p className="mt-5 text-sm text-ink-muted">
          Open the verification email and click the link. Once verification succeeds, you will be signed in automatically.
        </p>

        {message && (
          <div className="mt-5 rounded-card border border-status-success bg-status-successBg px-3 py-2 text-sm text-status-success">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
            {error}
          </div>
        )}

        {email && (
          <Button
            variant="secondary"
            className="mt-5 w-full"
            onClick={
              handleResend
            }
            disabled={
              resending ||
              resendSeconds > 0
            }
          >
            {resending
              ? 'Sending…'
              : resendSeconds > 0
                ? `Resend available in ${resendSeconds}s`
                : 'Resend verification email'}
          </Button>
        )}

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