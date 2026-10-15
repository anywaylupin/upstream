import { Button as ButtonPrimitive } from '@base-ui/react/button';

import { cn, tv, type VariantProps } from 'tailwind-variants';

/**
 * Customised for Upstream's gauge-station look; re-adding this component with the shadcn CLI wipes it, so diff before you do.
 * Outline and ghost are transparent: the stock outline filled itself with the page colour, which read as a grey box on every lighter card.
 * Sizes start at 32px (sm) with 13px text; the stock 28px buttons and 12.8px labels felt cramped next to rows.
 */
const buttonVariants = tv({
  base: "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/45 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:bg-primary/88',
      outline:
        'border-border bg-transparent text-foreground hover:border-foreground/25 hover:bg-foreground/[0.04] aria-expanded:bg-foreground/[0.06]',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-foreground/[0.08] aria-expanded:bg-foreground/[0.08]',
      ghost:
        'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground aria-expanded:bg-foreground/[0.06] aria-expanded:text-foreground',
      destructive: 'bg-destructive text-white hover:bg-destructive/88 focus-visible:ring-destructive/30',
      link: 'text-brand underline-offset-4 hover:underline'
    },
    size: {
      default: 'h-9 gap-2 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
      xs: "h-7 gap-1 px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
      sm: "h-8 gap-1.5 px-3 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
      lg: 'h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5',
      icon: 'size-9',
      'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3.5",
      'icon-sm': 'size-8',
      'icon-lg': 'size-10'
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'default'
  }
});

function Button({
  className = '',
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
