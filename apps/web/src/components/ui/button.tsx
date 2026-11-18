import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-label whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-busy:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover dark:bg-destructive/60",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-(--control-height) px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-(--control-height-sm) gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-(--control-height)",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-(--control-height-sm)",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner and ignores clicks; the caller swaps the label for its gerund. */
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      aria-busy={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
