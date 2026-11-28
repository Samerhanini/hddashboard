import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Projects & Tasks · Hanini',
  description: 'Hanini projects, schedules, finance, meetings and weekly agendas.',
  applicationName: 'hanini',
  appleWebApp: { title: 'hanini' },
  robots: { index: false, follow: false },
};

// Phones render the dashboard at a fixed desktop width and shrink it to
// fit, instead of reflowing: the layout viewport is 1440px (sidebar 224 +
// main content incl. the 1080px roster table), so the whole dashboard is
// visible at once and pinch-zoom still works. Desktop browsers ignore the
// viewport width, so nothing changes there. (Full-size scroll-sideways was
// tried Nov 28 and Samer went back to zoomed-out the same morning.)
export const viewport: Viewport = {
  width: 1440,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
