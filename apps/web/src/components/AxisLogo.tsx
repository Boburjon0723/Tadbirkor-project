import Image from 'next/image';

type AxisLogoProps = {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  className?: string;
};

export function AxisLogo({
  size = 40,
  showText = true,
  textClassName = 'text-xl font-bold tracking-tight text-white',
  className = '',
}: AxisLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <Image
        src={`/brand/axis-logo.png?v=${process.env.NEXT_PUBLIC_ASSET_VERSION || '1'}`}
        alt="Axis ERP"
        width={size}
        height={size}
        style={{ width: size, height: 'auto' }}
        className="rounded-xl object-cover shrink-0 shadow-lg shadow-blue-500/25 ring-1 ring-white/10"
        priority
      />
      {showText && <span className={`truncate ${textClassName}`}>Axis ERP</span>}
    </div>
  );
}
