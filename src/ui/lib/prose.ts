import { cn } from './utils';

/**
 * Long-form pages (privacy, about) are prose, not UI. Rather than carry a
 * typography plugin for two documents, the rhythm is declared once here and
 * applied to the article element.
 */
export const PROSE = cn(
  'mx-auto max-w-[68ch] pt-10 pb-10 text-[14px] leading-relaxed',
  '[&_h1]:text-[28px] [&_h1]:leading-[1.15] [&_h1]:font-semibold [&_h1]:tracking-[-0.02em]',
  '[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-[15px] [&_h2]:font-semibold',
  '[&_p]:mt-3 [&_p]:text-muted-foreground',
  '[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5',
  '[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5',
  '[&_li]:text-muted-foreground',
  '[&_li>strong]:text-foreground',
  '[&_strong]:font-semibold',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-primary/80',
  '[&_code]:mono [&_code]:rounded-sm [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12.5px] [&_code]:text-foreground',
);
