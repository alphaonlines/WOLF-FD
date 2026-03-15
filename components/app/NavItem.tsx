import React from 'react';

type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isOpen: boolean;
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

const NavItem: React.FC<NavItemProps> = (props) => {
  const { icon, label, isActive, isOpen } = props;
  const className = `
    w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all duration-200
    ${
      isActive
        ? 'bg-sky-400/12 border-sky-300/28 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
        : 'border-transparent text-slate-300 hover:bg-white/6 hover:border-white/8 hover:text-slate-50'
    }
    ${!isOpen && 'justify-center'}
  `;

  if ('href' in props) {
    return (
      <a
        href={props.href}
        target={props.target}
        rel={props.rel}
        className={className}
        title={!isOpen ? label : ''}
      >
        {icon}
        {isOpen && <span className="font-medium text-sm">{label}</span>}
      </a>
    );
  }

  return (
    <button
      onClick={props.onClick}
      className={className}
      title={!isOpen ? label : ''}
    >
      {icon}
      {isOpen && <span className="font-medium text-sm">{label}</span>}
    </button>
  );
};

export default NavItem;
