import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../../lib/utils';

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-x-2.5 rounded-md border px-3 py-2.5 text-[12.5px] [&>svg]:mt-0.5 [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground',
        note: 'border-empty/25 bg-empty-tint text-empty',
        warning: 'border-missing/25 bg-missing-tint text-missing',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="note" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-title" className={cn('font-semibold', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('col-start-2', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
