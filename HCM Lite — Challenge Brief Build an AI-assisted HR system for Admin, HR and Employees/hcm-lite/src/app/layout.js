import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'HCM Lite — AI-Assisted Human Capital Management',
  description: 'Enterprise AI-assisted HR system for Admin, HR and Employees',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full bg-zinc-50 antialiased">
      <body className="min-h-full flex flex-col font-sans text-zinc-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
