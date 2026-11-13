import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crowdfunding Platform',
  description: 'Crowdfunding market test platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

