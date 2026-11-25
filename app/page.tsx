import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import Dashboard from '@/components/Dashboard';

export default async function Page() {
  // proxy.ts already sends signed-out visitors to /signin; this is a second check.
  const session = await auth();
  if (!session?.user?.email) redirect('/signin');

  return (
    <>
      <div className="pt-userbar">
        <span>{session.user.email}</span>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
          <button type="submit" className="pt-hidden-btn">Sign out</button>
        </form>
      </div>
      <Dashboard />
    </>
  );
}
