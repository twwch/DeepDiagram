export default function NotFound() {
  return (
    <html lang="zh">
      <body className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <p className="mt-4 text-lg text-gray-600">Page not found</p>
          <a href="/zh" className="mt-6 inline-block text-blue-600 hover:underline">Go Home</a>
        </div>
      </body>
    </html>
  );
}
