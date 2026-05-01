import React, { forwardRef, Ref } from 'react';

type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isOpen: boolean;
  isDarkMode: boolean;
  tourId?: string;
} & (
  | {
      onClick: () => void;
      href?: never;
      target?: never;
      rel?: never;
    }
  | {
      href: string;
      target?: string;
      rel?: string;
      onClick?: never;
    }
);

const NavItem = forwardRef<HTMLButtonElement | HTMLAnchorElement, NavItemProps>((props, ref) => {
  const { icon, label, isActive, isOpen, isDarkMode } = props;
  const className = `
    w-full flex items-center gap-3 px-3 py-4 h-14 rounded-2xl border transition-all duration-200
    ${
      isActive
        ? isDarkMode
          ? 'bg-sky-400/12 border-sky-300/28 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
          : 'bg-slate-900 border-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]'
        : isDarkMode
          ? 'border-transparent text-slate-300 hover:bg-white/6 hover:border-white/8 hover:text-slate-50'
          : 'border-transparent text-slate-700 hover:bg-slate-100/95 hover:border-slate-300/70 hover:text-slate-950'
    }
    ${!isOpen && 'justify-center'}
  `;

  if ('href' in props) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={props.href}
        target={props.target}
        rel={props.rel}
        className={className}
        data-tour-id={props.tourId}
        title={!isOpen ? label : ''}
      >
        {icon}
        {isOpen && <span className="font-medium text-base">{label}</span>}
      </a>
    );
  }

  return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        onClick={props.onClick}
        className={className}
        data-tour-id={props.tourId}
        title={!isOpen ? label : ''}
      >
      {icon}
      {isOpen && <span className="font-medium text-base">{label}</span>}
    </button>
  );
});

export default NavItem;
