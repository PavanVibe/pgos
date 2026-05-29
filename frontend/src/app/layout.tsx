import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PGOS - The Operating System for PGs',
  description: 'Automate your PG operations, rent tracking, and complaints.',
};

import { QueryProvider } from '@/providers/QueryProvider';
import ResidentProfileDrawer from '@/components/shared/ResidentProfileDrawer';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <QueryProvider>
        <html lang="en">
          <body className={inter.className}>
            {children}
            <ResidentProfileDrawer />
            <Toaster />
          </body>
        </html>
      </QueryProvider>
    </ClerkProvider>
  );
}