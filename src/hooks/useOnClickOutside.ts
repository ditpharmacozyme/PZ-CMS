import { useEffect } from 'react';

/**
 * Calls `handler` on a pointerdown/touchstart outside every ref in `refs`.
 *
 * There was no version of this anywhere in the codebase -- the app's four
 * ad-hoc dropdown implementations either hand-rolled their own invisible
 * `fixed inset-0` click-catcher div per instance (TopNav's brand picker) or
 * had no outside-click dismissal at all (TopNav's profile popover, which can
 * currently only be closed via its own X or by taking an action inside it).
 * `ui/Popover` uses this instead of a per-instance backdrop div.
 *
 * Takes an array of refs (not just one) so a trigger button and its popover
 * panel can both be excluded -- otherwise the mousedown that opens the
 * popover would also register as "outside" the panel (which doesn't exist
 * in the DOM yet at that point) and immediately close it back on the next
 * event, or clicking the trigger button itself to toggle-close would double
 * fire.
 */
export function useOnClickOutside(refs: React.RefObject<HTMLElement>[], handler: () => void, active: boolean = true): void {
  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (e: PointerEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const isInside = refs.some((ref) => ref.current?.contains(target));
      if (!isInside) handler();
    };

    // pointerdown (not click) so this fires before a click on some other
    // interactive element it might otherwise race against, matching how
    // native OS popovers dismiss on press-down rather than press-up.
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, handler]);
}
