import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Projects & Tasks · Hanini',
  description: 'Hanini projects, schedules, finance, meetings and weekly agendas.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
