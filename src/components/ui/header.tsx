
import { cn } from '@/lib/utils';

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  // Add any specific props if needed
}

export function Header({ className, ...props }: HeaderProps) {
  return (
    <header
      className={cn(
        "bg-background/95 backdrop-blur-sm border-b shadow-sm w-full sticky top-0 z-40",
        "flex flex-col",
        className
      )}
      {...props}
    />
  );
}

interface HeaderMainProps extends React.HTMLAttributes<HTMLDivElement> {
  //
}

export function HeaderMain({ className, ...props }: HeaderMainProps) {
    return (
        <div
            className={cn(
                "relative flex justify-center items-center w-full px-4 h-12 md:h-14",
                className
            )}
            {...props}
        />
    )
}

interface HeaderNavProps extends React.HTMLAttributes<HTMLElement> {
    //
}

export function HeaderNav({ className, ...props }: HeaderNavProps) {
    return (
        <nav
            className={cn(
                "flex justify-center items-center w-full py-2 space-x-1 md:space-x-2 border-t-[0.5px]",
                className
            )}
            {...props}
        />
    )
}
