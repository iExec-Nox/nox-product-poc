import type { Metadata } from "next";
import Script from "next/script";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { APP_URL } from "@/lib/config";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Nox Protocol",
      url: APP_URL,
      logo: `${APP_URL}/nox-icon.png`,
      description:
        "Confidential token protocol enabling encrypted ERC-20 transfers and selective disclosure on Ethereum.",
      sameAs: ["https://github.com/iExecBlockchainComputing"],
    },
    {
      "@type": "WebApplication",
      name: "Nox Confidential Token",
      url: APP_URL,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Wrap any ERC-20 into encrypted confidential tokens, transfer privately, and manage viewing permissions on-chain.",
    },
  ],
};

export const metadata: Metadata = {
  title: "Private Finance in Action — Confidential DeFi on Ethereum",
  description:
    "Wrap any ERC-20 into encrypted confidential tokens, transfer privately, and grant selective disclosure — all on-chain on Ethereum Sepolia. Try Nox now.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroSection />
      <FeaturesSection />
    </>
  );
}
