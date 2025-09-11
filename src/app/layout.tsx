
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext'; // Keep AuthProvider
import { ThemeProvider } from "@/components/ThemeProvider"; // New ThemeProvider import

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'WeekWise | AI-Powered Student Planner',
    template: '%s | WeekWise',
  },
  description: 'An intelligent weekly planner designed for students. Organize your schedule with AI, track study sessions with a Pomodoro timer, and manage academic goals. Import your timetable and plan for success.',
  keywords: [
    'student planner', 
    'academic planner', 
    'weekly planner', 
    'AI planner', 
    'study tracker', 
    'Pomodoro timer', 
    'goal setting for students', 
    'timetable app', 
    'college planner', 
    'university planner',
    'homework planner'
  ],
  authors: [{ name: 'WeekWise' }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'WeekWise | Your AI-Powered Educational Planner',
    description: 'Organize your schedule, track study sessions, and manage academic goals with an intelligent AI assistant.',
    url: 'https://weekwise-hxko9.web.app', // Using the production URL
    siteName: 'WeekWise',
    type: 'website',
    images: [
      {
        url: 'https://weekwise-hxko9.web.app/og-image.png', // Placeholder URL
        width: 1200,
        height: 630,
        alt: 'WeekWise Application Interface',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WeekWise | AI-Powered Student Planner',
    description: 'The smart way for students to plan their week, track goals, and manage time.',
    images: ['https://weekwise-hxko9.web.app/twitter-image.png'], // Placeholder URL
  },
  icons: {
    icon: '/favicon.ico', // Standard favicon
    apple: '/apple-touch-icon.png', // For Apple devices
  },
  manifest: '/site.webmanifest', // For PWA capabilities
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
