import { cn } from '@/lib/utils';

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
      'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-600/20',
      className
    )}>
      {children}
    </span>
  );
}
