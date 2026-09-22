import { redirect } from "next/navigation";

// Home was dropped from the product earlier (stakeholder feedback: it didn't
// add anything Team didn't already cover); Team itself was then dropped
// 2026-09-22 (James's decision -- see CLAUDE.md's Product UX revision note).
// The root route still needs to land somewhere -- 1:1s is the entry point now.
export default function RootPage() {
  redirect("/one-on-ones");
}
