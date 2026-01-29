import { cn } from '@/lib/utils';

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16', className)}>
      {children}
    </div>
  );
}
