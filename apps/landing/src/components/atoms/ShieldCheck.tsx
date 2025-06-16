export const ShieldCheck = ({ className }: { className: string }) => (
  <svg
    width="60"
    height="72"
    viewBox="0 0 60 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="teqo-stroke-gradient" x1="0" y1="0.5" x2="1" y2="0">
        <stop offset="0%" stopColor="#a54bf2" /> {/* pink-500 */}
        <stop offset="100%" stopColor="#451fb2" /> {/* purple-600 */}
      </linearGradient>
    </defs>
    <path
      d="M20 35.9999L26.6667 42.6665L40 29.3332M56.6667 39.3332C56.6667 55.9999 45 64.3332 31.1334 69.1665C30.4072 69.4126 29.6185 69.4008 28.9 69.1332C15 64.3332 3.33337 55.9999 3.33337 39.3332V15.9999C3.33337 15.1158 3.68456 14.268 4.30969 13.6428C4.93481 13.0177 5.78265 12.6665 6.66671 12.6665C13.3334 12.6665 21.6667 8.66654 27.4667 3.59987C28.1729 2.99653 29.0712 2.66504 30 2.66504C30.9289 2.66504 31.8272 2.99653 32.5334 3.59987C38.3667 8.69987 46.6667 12.6665 53.3334 12.6665C54.2174 12.6665 55.0653 13.0177 55.6904 13.6428C56.3155 14.268 56.6667 15.1158 56.6667 15.9999V39.3332Z"
      stroke="url(#teqo-stroke-gradient)"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
