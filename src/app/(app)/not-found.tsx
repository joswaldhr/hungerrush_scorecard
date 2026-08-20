import { EmptyState } from "@/components/empty-state";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <EmptyState
        title="Not found"
        description="The page or resource you requested does not exist."
      />
      <Link href="/" className="text-sm text-accent hover:underline">
        Back to Home
      </Link>
    </div>
  );
}
