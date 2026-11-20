import { redirect } from "next/navigation";

// Emergency funding now lives on the combined Pledges & Funding page
// (Release 2); keep the old URL working for bookmarks and notifications.
export default function EmergencyFundingRedirect() {
  redirect("/pledges#funding");
}
