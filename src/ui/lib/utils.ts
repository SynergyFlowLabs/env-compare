import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditional classes with conflict resolution, the shadcn convention.
 * `cn('px-4', isTight && 'px-2')` keeps the last spacing class instead of
 * emitting both and letting stylesheet order decide.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
