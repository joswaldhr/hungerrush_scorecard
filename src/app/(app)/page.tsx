import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Good morning{session?.user?.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Your weekly manager briefing</p>
    </div>
  );
}
