import React from 'react';

export interface StepDef {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepDef[];
  currentIndex: number;
  /** Steps at or before this index are clickable (already visited / current). */
  furthestIndex: number;
  onStepClick?: (index: number) => void;
}

/**
 * Purely presentational -- validation and step state live in the parent.
 * Visual language matches the existing pipeline stepper in PostDetailModal
 * (numbered circles, passed steps filled, current step accented) so it
 * already feels native rather than bolted on.
 */
export const Stepper: React.FC<StepperProps> = ({ steps, currentIndex, furthestIndex, onStepClick }) => {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Steps">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isPassed = index < currentIndex;
        const isClickable = Boolean(onStepClick) && index <= furthestIndex;

        return (
          <React.Fragment key={step.id}>
            <li className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(index)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex items-center gap-1.5 sm:gap-2 px-1 py-1 rounded-full transition-colors ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-label-caps flex-shrink-0 ${
                    isCurrent
                      ? 'bg-[var(--color-accent)] text-white'
                      : isPassed
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'bg-[var(--color-muted)] text-[var(--color-ink-muted)]'
                  }`}
                >
                  {isPassed ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`hidden sm:inline text-xs font-label-caps font-bold ${
                    isCurrent ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]'
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </li>
            {index < steps.length - 1 && (
              <li aria-hidden="true" className={`w-4 sm:w-8 h-px flex-shrink-0 ${isPassed ? 'bg-[var(--color-accent-soft)]' : 'bg-[var(--color-line)]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
};
