"use client";

import { PledgesSection } from "@/components/pledges-section";
import { EmergencyFundingSection } from "@/components/emergency-funding-section";
import { FeatureLockNotice } from "@/components/feature-lock-notice";

// Release 2: pledges and emergency funding on one page (playtest request).
// Both are "send or ask for help" between regions; the WHO HQ marketplace
// stays on its own page because it's buying, not aid.
export default function PledgesAndFundingPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-[32px] text-text">Pledges &amp; Funding</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Give resources to another region directly, or ask everyone (including WHO HQ) for emergency funding.{" "}
          <a href="#funding" className="font-medium text-accent-700 underline">
            Jump to emergency funding
          </a>
        </p>
      </div>
      <FeatureLockNotice feature="pledges">
        <PledgesSection />
        <div className="h-px bg-divider" />
        <EmergencyFundingSection />
      </FeatureLockNotice>
    </div>
  );
}
