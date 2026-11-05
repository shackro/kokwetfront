export default function KokwetText({ className = '', tone = 'brand' }) {
  const image = tone === 'light' ? 'kokwet-wordmark-light' : 'kokwet-wordmark';

  return (
    <span className={`inline-block align-middle leading-none ${className}`} aria-label="Kokwet">
      <img
        src={`/images/${image}.png`}
        alt=""
        aria-hidden="true"
        className="inline-block h-[.82em] w-auto align-[-.08em]"
        draggable="false"
      />
    </span>
  );
}
