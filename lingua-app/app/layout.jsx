import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import PostHogInit from '../components/PostHogInit';
import "./globals.css";

export const metadata = {
  title: "Lingua — Learn any language through content you love",
  description: "Paste a text and it becomes a complete guided learning session.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-7D021Z7S25" strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-7D021Z7S25');`}</Script>
      </head>
      <body>
        <PostHogInit />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
