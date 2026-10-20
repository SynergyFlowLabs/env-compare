import type * as React from 'react';

import { cn } from '../../lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex w-full rounded-md border border-input bg-card px-3 py-2 text-[13px] text-foreground outline-none',
        'placeholder:text-faint',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'resize-none scroll-quiet',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
