export default function AccountRecoverPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg bg-bg shadow-lg p-10 text-center">
        <h1 className="font-heading text-[34px] leading-[1.1] text-text mb-3">Account recovery</h1>
        <p className="text-[15px] text-neutral-800 mb-6 leading-[1.55]">
          This prototype doesn&apos;t send emails, so there&apos;s no automated password reset. If you registered
          with an email address on file, or need help another way, contact the maintainer directly and they can help
          you regain access.
        </p>
        <a
          href="mailto:hello@example.edu?subject=Operation%20Veiled%20Horizon%20account%20recovery"
          className="inline-flex w-full items-center justify-center rounded-full bg-accent-700 text-white px-[26px] py-[11px] text-[15px] font-semibold hover:bg-accent-600 active:bg-accent-800 transition-colors"
        >
          Email the maintainer
        </a>
        <p className="text-[13px] text-neutral-700 mt-5">
          <a href="/login" className="text-accent-700 hover:text-accent">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
