import { FeatureCard } from "@/components/landing/feature-card";

const FEATURES = [
  {
    icon: "/feature-icon.svg",
    title: "DeFi Composability",
    description:
      "Works seamlessly across existing and future DeFi ecosystems.",
  },
  {
    icon: "/feature-icon.svg",
    title: "Selective Disclosure",
    description:
      "Define who can see what, and when. Grant regulators or auditors access when required.",
  },
  {
    icon: "/feature-icon.svg",
    title: "Scalable Confidentiality",
    description:
      "Execute complex financial workflows confidentially at scale without redesigning smart contracts.",
  },
];

export function FeaturesSection() {
  return (
    <section className="flex w-full flex-col items-center gap-10 py-10 md:py-[60px] lg:py-16">
      <div className="flex flex-col items-start gap-5 px-10 md:items-center md:px-20 lg:px-40">
        <h2 className="font-mulish text-[28px] font-bold leading-normal text-text-heading md:font-anybody md:text-[32px] md:leading-[1.2]">
          The Next Evolution of DeFi Is Confidential
        </h2>
        <p className="font-mulish text-base leading-[1.6] text-text-body md:text-lg">
          Confidential Token removes transparency as a barrier to institutional adoption.
        </p>
      </div>
      <div className="flex w-full flex-col gap-10 px-[30px] md:flex-row md:px-10 lg:px-40">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}
