import { Link } from '@/lib/i18n/navigation';

export default function NotFound() {
  return (
    <section className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-lg text-gray-500">Page not found</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Go Home
        </Link>
      </div>
    </section>
  );
}
