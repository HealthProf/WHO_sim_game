import { SlideDeck } from "@/components/slide-deck";
import { slidesFor } from "@/lib/db/seed-data/orientation-slides";

export default function InstructorChecklistPage() {
  return <SlideDeck slides={slidesFor("instructor")} />;
}
