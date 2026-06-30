import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  iconSize?: "xs" | "sm" | "md";
  font?: "mulish" | "inter";
  textColorClass?: string;
}

const sizeClasses = {
  xs: "size-[18px] md:size-5",
  sm: "size-[22px] md:size-7",
  md: "size-[26px] md:size-8",
};

const textClasses = {
  xs: "text-xs font-semibold md:text-sm",
  sm: "text-sm font-bold md:text-xl",
  md: "text-sm font-bold md:text-xl",
} as const;

export function Logo({
  iconSize = "md",
  font = "mulish",
  textColorClass,
}: LogoProps) {
  const sizeClass = sizeClasses[iconSize];
  const textClass = textClasses[iconSize];
  const fontClass = font === "inter" ? "font-inter" : "font-mulish";
  const gapClass = iconSize === "xs" ? "gap-2 md:gap-2.5" : "gap-3 md:gap-[18px]";
  const roundedClass = iconSize === "xs" ? "rounded-lg" : "rounded-[10px] md:rounded-xl";

  return (
    <Link href="/" className={`flex items-center ${gapClass}`}>
      <div
        className={`relative ${sizeClass} overflow-hidden ${roundedClass}`}
      >
        <Image src="/nox-icon.png" alt="Nox logo" fill sizes="32px" className="object-cover" />
      </div>
      <span
        className={`${fontClass} ${textClass} tracking-tight ${textColorClass ?? "text-logo-text"}`}
      >
        Confidential Token
      </span>
    </Link>
  );
}
