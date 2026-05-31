import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Houndex Review',
  description: 'Synthetic claim curation and citation review surface for Houndex.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
