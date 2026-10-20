import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * shadcn's badge plus one variant per comparison state. The state variants are
 * what stop "commented out" from being rendered as an error.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
        missing: 'border-missing/25 bg-missing-tint text-missing',
        empty: 'border-empty/25 bg-empty-tint text-empty',
        placeholder: 'border-placeholder/25 bg-placeholder-tint text-placeholder',
        commented: 'border-commented/25 bg-commented-tint text-commented',
        ok: 'border-ok/25 bg-ok-tint text-ok',
        differs: 'border-differs/25 bg-differs-tint text-differs',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
