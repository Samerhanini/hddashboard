import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// Google sign-in, limited to accounts on one Google Workspace domain (hanini.com by default).
// Settings come from the environment: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_ALLOWED_DOMAIN.

export const ALLOWED_DOMAIN = (process.env.AUTH_ALLOWED_DOMAIN || 'hanini.com').trim().toLowerCase();

/** True once the Google sign-in credentials are set. Until then nobody can sign in, so the site stays locked. */
export const authConfigured = !!(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // `hd` makes Google's account chooser show only accounts on our domain; the signIn check below enforces it.
      authorization: { params: { hd: ALLOWED_DOMAIN, prompt: 'select_account' } },
    }),
  ],
  pages: { signIn: '/signin', error: '/signin' },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider !== 'google' || !profile) return false;
      const email = String(profile.email || '').toLowerCase();
      const hd = String((profile as { hd?: string }).hd || '').toLowerCase();
      return profile.email_verified === true && email.endsWith('@' + ALLOWED_DOMAIN) && hd === ALLOWED_DOMAIN;
    },
  },
});
