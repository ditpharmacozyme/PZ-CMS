import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]',
  secondary: 'bg-[var(--color-raised)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)]',
  ghost: 'bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-ink)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white',
};

const SIZE_CLASS: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[36px]',
  md: 'px-4 py-2.5 text-xs min-h-[44px]',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`font-label-caps font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : (
        icon && <span className="material-symbols-outlined text-base">{icon}</span>
      )}
      {children}
      {!loading && iconRight && <span className="material-symbols-outlined text-base">{iconRight}</span>}
    </button>
  );
};
