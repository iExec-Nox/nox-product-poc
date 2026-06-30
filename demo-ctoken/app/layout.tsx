import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Mulish, Anybody, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "@/components/providers";
import { APP_URL, CONFIG } from "@/lib/config";
import "./globals.css";

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const anybody = Anybody({
  variable: "--font-anybody",
  subsets: ["latin"],
  weight: ["700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Confidential Token by iExec",
    template: "%s | Confidential Token by iExec",
  },
  description:
    "Transform any ERC-20 into confidential and auditable on-chain assets. The missing privacy layer for institutional DeFi on Ethereum.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Confidential Token by iExec",
    title: "Confidential Token by iExec",
    description:
      "Transform any ERC-20 into confidential and auditable on-chain assets. The missing privacy layer for institutional DeFi on Ethereum.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 675,
        alt: "Confidential Token by iExec",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Confidential Token by iExec",
    description:
      "Transform any ERC-20 into confidential and auditable on-chain assets. The missing privacy layer for institutional DeFi on Ethereum.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieString = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  return (
    <html lang="en" suppressHydrationWarning>
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${CONFIG.gtm.id}');`,
        }}
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined"
        precedence="default"
      />
      <body
        className={`${mulish.variable} ${anybody.variable} ${inter.variable} flex min-h-screen flex-col antialiased`}
      >
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${CONFIG.gtm.id}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Providers cookies={cookieString}>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
