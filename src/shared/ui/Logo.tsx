interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <img
      src="/favicon.svg"
      alt="LittleFlower"
      width={size}
      height={size}
      className={className}
    />
  );
}
