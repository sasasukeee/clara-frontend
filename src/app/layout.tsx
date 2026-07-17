import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import "../styles/globals.css";
import { AuthBootstrap } from "@/features/auth/client/AuthBootstrap";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

const inter = Manrope({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clara AI",
  description: "Clara AI uygulaması",
  icons: {
    icon: "/plus_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('clara-theme');if(t!=='dark'&&t!=='light'){var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');t=m&&m.matches?'dark':'light';}var isDark=t==='dark';document.documentElement.classList.toggle('dark',isDark);document.documentElement.dataset.theme=isDark?'dark':'light';}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-[var(--background)] text-[var(--foreground)]`}
      >
        <I18nProvider>
          <AuthBootstrap />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
