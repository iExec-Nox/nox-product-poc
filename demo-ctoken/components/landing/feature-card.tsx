import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="flex-1 gap-2.5 rounded-2xl border-feature-card-border bg-feature-card-bg px-5 py-5 shadow-none backdrop-blur-sm md:gap-3.5 md:px-10 md:py-6 lg:gap-4 lg:py-9">
      <CardHeader className="p-0">
        <div className="flex size-10 items-center justify-center rounded-xl bg-card-icon-bg md:size-11 lg:size-12">
          <Image src={icon} alt="" width={28} height={28} className="size-[26px] md:size-[28px] lg:size-7" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-0 md:gap-3 lg:gap-4">
        <h3 className="font-inter text-[17px] font-bold leading-7 text-text-heading md:text-lg">
          {title}
        </h3>
        <p className="font-inter text-[13px] leading-[22px] text-text-body md:text-sm md:leading-[24px]">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
