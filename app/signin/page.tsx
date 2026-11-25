import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ALLOWED_DOMAIN, auth, authConfigured, signIn } from '@/auth';

export const metadata: Metadata = { title: 'Sign in · Projects & Tasks' };

/** Only same-site paths are allowed as the place to return to after signing in. */
function safeReturn(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : '/';
}

const ERRORS: Record<string, string> = {
  AccessDenied: `Only @${ALLOWED_DOMAIN} Google accounts can sign in. Choose your work account and try again.`,
  Configuration: 'Sign-in isn’t set up correctly. Ask the site administrator to check the Google sign-in settings.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = safeReturn(params.callbackUrl);
  if (authConfigured && (await auth())?.user) redirect(returnTo);
  const error = typeof params.error === 'string' ? ERRORS[params.error] || 'Sign-in didn’t work. Please try again.' : null;

  return (
    <main className="pt-signin">
      <div className="pt-card pt-signin-card">
        <h1 className="pt-signin-title">Projects &amp; Tasks</h1>
        <p className="pt-sub">Hanini Development · Urban Core Builders · Brick Studios</p>
        {!authConfigured ? (
          <p className="pt-notice">Sign-in isn’t set up yet. The site stays locked until the Google sign-in settings are added.</p>
        ) : (
          <>
            {error && <p className="pt-signin-error" role="alert">{error}</p>}
            <form action={async () => { 'use server'; await signIn('google', { redirectTo: returnTo }); }}>
              <button type="submit" className="pt-signin-btn">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
                Sign in with Google
              </button>
            </form>
            <p className="pt-sub pt-signin-note">Use your @{ALLOWED_DOMAIN} account.</p>
          </>
        )}
      </div>
    </main>
  );
}
