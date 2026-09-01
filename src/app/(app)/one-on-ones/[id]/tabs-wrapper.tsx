"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ReactNode } from "react";

export function OneOnOneTabs({
  defaultTab,
  prepareContent,
  duringContent,
  afterContent,
  badges,
}: {
  defaultTab?: string;
  prepareContent: ReactNode;
  duringContent: ReactNode;
  afterContent: ReactNode;
  badges: { prepare: number; during: number; after: number };
}) {
  const tab = defaultTab === "during" || defaultTab === "after" ? defaultTab : "prepare";

  return (
    <Tabs defaultValue={tab}>
      <TabsList className="gap-6 border-b-0 pb-0">
        <TabsTrigger value="prepare" className="text-sm font-bold pb-2">
          Prepare
          {badges.prepare > 0 && (
            <span className="ml-1.5 text-[10px] font-bold text-[#009ca6] bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
              {badges.prepare}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="during" className="text-sm font-bold pb-2">
          During
          {badges.during > 0 && (
            <span className="ml-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
              {badges.during}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="after" className="text-sm font-bold pb-2">
          After
          {badges.after > 0 && (
            <span className="ml-1.5 text-[10px] font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full border border-border">
              {badges.after}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="prepare" className="pt-6">
        {prepareContent}
      </TabsContent>
      <TabsContent value="during" className="pt-6">
        {duringContent}
      </TabsContent>
      <TabsContent value="after" className="pt-6">
        {afterContent}
      </TabsContent>
    </Tabs>
  );
}
