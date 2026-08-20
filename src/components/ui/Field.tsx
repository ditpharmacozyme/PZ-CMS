import React, { useId } from 'react';

/**
 * The single biggest legibility fix in this layer: every label in the app
 * today is `font-label-caps text-[10px] uppercase font-bold` -- 10px
 * monospace all-caps. Field standardizes on 13px sentence case. The old caps
 * style still exists (as `.font-label-caps`) for section eyebrows; it just
 * stops being used for "what do I type here".
 */

interface FieldShellProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldShellProps> = ({ label, required, hint, error, htmlFor, children }) => {
  const hintId = useId();
  return (
    <div>
      <label htmlFor={htmlFor} className="font-body-md text-[13px] font-medium text-[var(--color-ink-soft)] block mb-1.5">
        {label}
        {required && <span className="text-[var(--color-danger)] ml-1 font-normal text-xs">Required</span>}
      </label>
      {hint && !error && <p id={hintId} className="text-[11px] text-[var(--color-ink-muted)] mb-1.5">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-[11px] text-[var(--color-danger)] mt-1">{error}</p>
      )}
    </div>
  );
};

const inputBaseClass = (hasError?: boolean) =>
  `w-full bg-[var(--color-raised)] border rounded-lg px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-1 transition-colors ${
    hasError
      ? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]'
      : 'border-[var(--color-line)] focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]'
  }`;

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  value: string;
  onChange: (value: string) => void;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, required, hint, error, value, onChange, id, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    return (
      <Field label={label} required={required} hint={hint} error={error} htmlFor={inputId}>
        <input
          ref={ref}
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={inputBaseClass(Boolean(error))}
          {...rest}
        />
      </Field>
    );
  }
);
TextField.displayName = 'TextField';

interface TextAreaFieldProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  value: string;
  onChange: (value: string) => void;
  showCharCount?: boolean;
}

export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label, required, hint, error, value, onChange, showCharCount, id, rows = 4, ...rest
}) => {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={inputId}>
      <textarea
        id={inputId}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        className={`${inputBaseClass(Boolean(error))} resize-none`}
        {...rest}
      />
      {showCharCount && (
        <p className="text-[10px] text-[var(--color-ink-muted)] mt-1 text-right">{value.length} characters</p>
      )}
    </Field>
  );
};

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({ label, required, hint, error, value, onChange, options, disabled }) => {
  const autoId = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={autoId}>
      <select
        id={autoId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        className={`${inputBaseClass(Boolean(error))} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </Field>
  );
};
