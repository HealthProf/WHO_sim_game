// Update 2: makes the license reachable "from anywhere a user would
// reasonably look" — mounted in both the team and instructor layouts (so
// it's present on every signed-in page in both Demo and Class Session
// mode), plus the login page, the mode-selection page, and the credential
// sheet. Deliberately NOT mounted on app/display/[token]/page.tsx — that's
// the app's one full-bleed, no-chrome projector surface, and a footer would
// break it.
const GITHUB_LICENSE_URL = "https://github.com/HealthProf/WHO_sim_game/blob/main/LICENSE.md";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-divider px-[22px] py-4 text-[12px] text-neutral-700 lg:px-[34px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>© {new Date().getFullYear()} Timothy Curry. Operation Veiled Horizon.</span>
        <a href="/license" className="underline decoration-1 underline-offset-2 hover:text-text">
          License
        </a>
        <a
          href={GITHUB_LICENSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-1 underline-offset-2 hover:text-text"
        >
          Source on GitHub
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </footer>
  );
}
