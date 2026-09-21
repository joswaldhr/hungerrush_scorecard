"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin, VIEW_AS_COOKIE } from "@/lib/auth/authorization";

export async function setViewAs(formData: FormData) {
  await requireAdmin();

  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) {
    redirect("/admin");
  }

  const cookieStore = await cookies();
  cookieStore.set(VIEW_AS_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/");
}

export async function clearViewAs() {
  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);
  redirect("/admin");
}
