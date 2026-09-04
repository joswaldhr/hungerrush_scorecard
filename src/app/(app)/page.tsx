import { redirect } from "next/navigation";

// Home was dropped from the product (stakeholder feedback: it didn't add
// anything Team didn't already cover) but the root route still needs to land
// somewhere -- Team is the actual entry point now.
export default function RootPage() {
  redirect("/team");
}
