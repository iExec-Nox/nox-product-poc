import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | Nox Confidential Token",
  description:
    "Terms of use for the Nox Confidential Token demo application on Ethereum Sepolia testnet.",
};

const LAST_UPDATED = "March 7, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:px-20 lg:px-40">
      <h1 className="font-anybody text-4xl font-bold text-text-heading">
        Terms of Use
      </h1>
      <p className="mt-2 font-mulish text-sm text-text-muted">
        Last updated: {LAST_UPDATED}
      </p>

      <div className="mt-10 space-y-8 font-mulish text-text-body">
        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using the Nox Confidential Token application (the
            &quot;App&quot;), you agree to be bound by these Terms of Use. If
            you do not agree with any part of these terms, you must not use the
            App.
          </p>
        </Section>

        <Section title="2. Testnet Disclaimer">
          <p>
            The App operates exclusively on the <strong>Ethereum Sepolia
            testnet</strong>. All tokens displayed, minted, wrapped, or
            transferred within the App have <strong>no real monetary
            value</strong>. This is a demonstration and testing environment
            only. Do not send real assets to any address generated or displayed
            by the App.
          </p>
        </Section>

        <Section title="3. Confidential Tokens">
          <p>
            The App showcases confidential tokens (cTokens) built on the
            ERC-7984 standard. While the protocol is designed to provide
            on-chain confidentiality through encrypted balances and selective
            disclosure, <strong>no guarantee of absolute privacy or
            confidentiality</strong> is made. The technology is experimental and
            under active development.
          </p>
        </Section>

        <Section title="4. Wallet Responsibility">
          <p>
            You are solely responsible for the security and management of your
            wallet, private keys, and seed phrases. The App does not store,
            access, or recover your private keys. Loss of access to your wallet
            is permanent and irreversible.
          </p>
        </Section>

        <Section title="5. No Financial Advice">
          <p>
            Nothing in the App constitutes financial, investment, legal, or tax
            advice. The App is provided for educational and demonstration
            purposes only. You should consult appropriate professionals before
            making any financial decisions.
          </p>
        </Section>

        <Section title="6. Intellectual Property">
          <p>
            The Nox protocol, its smart contracts, SDK, and this application are
            developed by <strong>iExec Blockchain Tech</strong>. All
            intellectual property rights remain with their respective owners.
            You may not copy, modify, or distribute any part of the App without
            prior written consent.
          </p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>
            The App is provided &quot;as is&quot; and &quot;as available&quot;
            without warranties of any kind. iExec Blockchain Tech shall not be
            liable for any losses, damages, or claims arising from your use of
            the App, including but not limited to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Loss of testnet tokens or assets</li>
            <li>Smart contract bugs or vulnerabilities</li>
            <li>Network downtime or transaction failures</li>
            <li>Unauthorized access to your wallet</li>
          </ul>
        </Section>

        <Section title="8. Prohibited Use">
          <p>
            You agree not to use the App for any unlawful purpose, to attempt to
            exploit or disrupt the underlying smart contracts or infrastructure,
            or to interfere with other users&apos; access to the App.
          </p>
        </Section>

        <Section title="9. Modifications">
          <p>
            We reserve the right to modify these Terms of Use at any time.
            Changes will be reflected by updating the &quot;Last updated&quot;
            date above. Continued use of the App after modifications constitutes
            acceptance of the revised terms.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            For questions about these Terms of Use, please contact the iExec
            team at{" "}
            <a
              href="https://iex.ec"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:opacity-80"
            >
              iex.ec
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-inter text-lg font-bold text-text-heading">
        {title}
      </h2>
      <div className="mt-2 leading-relaxed">{children}</div>
    </section>
  );
}
