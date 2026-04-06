const VisaIcon = ({ className = "h-6 w-auto" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg">
    <rect width="780" height="500" rx="40" fill="#1A1F71" />
    <path d="M293.2 348.7l33.4-195.7h53.4l-33.4 195.7h-53.4zm224.5-190.9c-10.6-4-27.2-8.3-47.9-8.3-52.8 0-90 26.6-90.3 64.7-.3 28.2 26.6 43.9 46.9 53.3 20.8 9.6 27.8 15.8 27.7 24.4-.1 13.2-16.6 19.2-32 19.2-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 43.8c12.5 5.5 35.6 10.2 59.6 10.5 56.2 0 92.7-26.3 93.1-67 .2-22.3-14-39.3-44.8-53.3-18.7-9.1-30.1-15.1-30-24.3 0-8.1 9.7-16.8 30.6-16.8 17.5-.3 30.1 3.5 40 7.5l4.8 2.3 7.2-42.7zm138.3-4.8h-41.3c-12.8 0-22.4 3.5-28 16.3l-79.4 179.4h56.2l11.2-29.3h68.6l6.5 29.3h49.6l-43.3-195.7zm-65.9 126.2c4.4-11.3 21.5-54.7 21.5-54.7-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47.2 12.5 57.1h-44.7v-.6zM247.8 153l-49.3 133.5-5.3-25.5c-9.1-29.2-37.5-60.9-69.2-76.8l47.9 164.4h56.6l84.2-195.7h-64.9z" fill="#fff" />
    <path d="M146.9 153H60.3l-.7 3.9c67.2 16.2 111.7 55.4 130.1 102.5l-18.8-90.1c-3.2-12.4-12.6-16-23.9-16.3z" fill="#F9A533" />
  </svg>
);

const MastercardIcon = ({ className = "h-6 w-auto" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg">
    <rect width="780" height="500" rx="40" fill="#fff" />
    <circle cx="312" cy="250" r="150" fill="#EB001B" />
    <circle cx="468" cy="250" r="150" fill="#F79E1B" />
    <path d="M390 130.7c38.1 30.2 62.5 77 62.5 129.3s-24.4 99.1-62.5 129.3c-38.1-30.2-62.5-77-62.5-129.3s24.4-99.1 62.5-129.3z" fill="#FF5F00" />
  </svg>
);

const AmexIcon = ({ className = "h-6 w-auto" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg">
    <rect width="780" height="500" rx="40" fill="#2E77BC" />
    <text x="390" y="280" textAnchor="middle" fill="#fff" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="120">AMEX</text>
  </svg>
);

const GooglePayIcon = ({ className = "h-6 w-auto" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg">
    <rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" strokeWidth="4" />
    <text x="390" y="280" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="100">
      <tspan fill="#4285F4">G</tspan>
      <tspan fill="#333"> Pay</tspan>
    </text>
  </svg>
);

const ApplePayIcon = ({ className = "h-6 w-auto" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg">
    <rect width="780" height="500" rx="40" fill="#000" />
    <text x="390" y="290" textAnchor="middle" fill="#fff" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="120"> Pay</text>
  </svg>
);

export { VisaIcon, MastercardIcon, AmexIcon, GooglePayIcon, ApplePayIcon };
