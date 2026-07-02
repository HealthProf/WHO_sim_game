// Item 10's scripted interjections library — one-click pre-written injects
// for a facilitator to fire mid-session, either at one region or the whole
// room. This is improv support: not every facilitator is comfortable
// making up a plausible complication on the spot, and a small curated pool
// means the injects are consistently well-written rather than whatever
// comes to mind under time pressure. Delivered via teamNotifications
// (kind "interjection") — see app/api/instructor/interjection/route.ts.

export interface Interjection {
  id: string;
  title: string;
  message: string;
}

export const interjections: Interjection[] = [
  {
    id: "journalist-call",
    title: "Press Inquiry",
    message: "A journalist just called asking for comment on a leaked internal memo. You have until the next update to decide how — or whether — to respond.",
  },
  {
    id: "rival-statement",
    title: "Rival Public Statement",
    message: "A neighboring regional office just issued a public statement contrasting its own response with yours. It's already being shared.",
  },
  {
    id: "data-integrity",
    title: "Data Integrity Question",
    message: "An independent researcher has publicly questioned whether your reported case numbers reflect what's actually happening on the ground.",
  },
  {
    id: "supply-delay",
    title: "Supply Chain Delay",
    message: "A shipment you were counting on has been delayed at a border crossing with no clear timeline for release.",
  },
  {
    id: "staff-morale",
    title: "Staff Morale Flashpoint",
    message: "Word has reached your office that frontline staff are organizing an informal meeting to discuss working conditions.",
  },
  {
    id: "social-media",
    title: "Social Media Moment",
    message: "A photo from inside one of your facilities is circulating online with a caption you didn't write and can't fully verify.",
  },
  {
    id: "donor-question",
    title: "Donor Follow-Up",
    message: "A major donor's office has requested an informal call to \"better understand recent decisions\" before their next funding cycle.",
  },
  {
    id: "unexpected-visitor",
    title: "Unexpected Visitor",
    message: "A senior official from a neighboring government has requested an unscheduled meeting, arriving within the hour.",
  },
  {
    id: "whistleblower",
    title: "Internal Concern Raised",
    message: "Someone inside your own organization has quietly raised a concern about how a recent decision was actually implemented on the ground.",
  },
  {
    id: "good-news",
    title: "Unexpected Good News",
    message: "A local partner organization has offered additional support you weren't expecting — worth deciding quickly whether and how to use it.",
  },
];
