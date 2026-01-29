import { cn } from '@/lib/utils';
import { Container } from './Container';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
}

export function Section({ children, className, containerClassName, id }: SectionProps) {
  return (
    <section id={id} className={cn('py-20 sm:py-28', className)}>
      <Container className={containerClassName}>
        {children}
      </Container>
    </section>
  );
}
