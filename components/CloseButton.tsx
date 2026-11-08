import { X } from 'lucide-react';

interface CloseButtonProps {
  onClick: () => void;
  className?: string;
  'aria-label'?: string;
}

// p-3 around the icon: 44px on a phone (20px icon; Apple's 44pt, R12 in
// docs/ux-research/06-mobile-audit.md), 48px from md (24px icon).
export function CloseButton({ onClick, className = '', 'aria-label': ariaLabel = 'Close' }: CloseButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors ${className}`}
      aria-label={ariaLabel}
    >
      <X className="w-5 h-5 md:w-6 md:h-6" />
    </button>
  );
}
