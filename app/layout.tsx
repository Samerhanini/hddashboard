import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Projects & Tasks · Hanini',
  description: 'Hanini projects, schedules, finance, meetings and weekly agendas.',
  applicationName: 'hanini',
  appleWebApp: { title: 'hanini' },
  robots: { index: false, follow: false },
};

// No fixed viewport: phones use the default device-width viewport, and the
// desktop layout is kept by the min-width on .pt-wrap in globals.css — the
// page stays full-size and scrolls sideways instead of reflowing. (A fixed
// 1440px viewport was tried Nov 27 and Samer didn't like the zoomed-out
// look, so it was reverted.)


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
