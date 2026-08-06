export default function AccountRecoverPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-100 mb-3">Account recovery</h1>
        <p className="text-sm text-slate-400 mb-6">
          This prototype doesn&apos;t send emails, so there&apos;s no automated password reset. If you registered
          with an email address on file, or need help another way, contact the maintainer directly and they can help
          you regain access.
        </p>
        <a
          href="mailto:hello@example.edu?subject=Operation%20Veiled%20Horizon%20account%20recovery"
          className="inline-block rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 px-4 transition"
        >
          Email the maintainer
        </a>
        <p className="text-sm text-slate-500 mt-6">
          <a href="/login" className="text-blue-400 hover:text-blue-300">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
