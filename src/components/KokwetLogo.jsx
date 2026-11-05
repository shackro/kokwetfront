export default function KokwetLogo({ variant = 'full', tone = 'brand', src, className = 'w-64' }) {
  const isFull = variant === 'full';
  const imageName = isFull ? 'kokwet-logo' : 'kokwet-wordmark';
  const toneSuffix = tone === 'light' ? '-light' : '';
  const label = isFull ? 'Kokwet Festival — Culture Meets the Future' : 'Kokwet';

  return (
    <img
      src={src || `/images/${imageName}${toneSuffix}.png`}
      alt={label}
      className={className}
      draggable="false"
    />
  );
}
