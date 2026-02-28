import React from 'react';

interface LogoProps {
  className?: string;
}

export function Logo({ className = "" }: LogoProps) {
  return (
    <div className={`flex items - center ${className} `}>
      {/* Official Wealthsimple Wordmark SVG injected with a filter to show correctly on dark or light bg */}
      {/* For dark mode (--ws-bg-primary = #1D1D1C), we invert the logo to white */}
      <img
        src="https://www.wealthsimple.com/_next/static/media/ws-wordmark-refresh.3499def3.svg"
        alt="Wealthsimple"
        className="h-6 w-auto"
        style={{
          filter: "brightness(0) invert(1)"
        }}
      />
    </div>
  );
}
