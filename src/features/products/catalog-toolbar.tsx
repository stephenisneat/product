"use client";

import { type ReactNode } from "react";
import {
  BriefcaseIcon,
  ChartNoAxesCombinedIcon,
  LightbulbIcon,
  PaletteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function VisualizerButton() {
  return (
    <Button type="button" variant="outline" size="sm">
      <ChartNoAxesCombinedIcon data-icon="inline-start" />
      Visualizer
    </Button>
  );
}

function JobsButton() {
  return (
    <Button type="button" variant="outline" size="sm">
      <BriefcaseIcon data-icon="inline-start" />
      Jobs
    </Button>
  );
}

function InsightsButton() {
  return (
    <Button type="button" variant="outline" size="sm">
      <LightbulbIcon data-icon="inline-start" />
      Insights
    </Button>
  );
}

function CreativesButton() {
  return (
    <Button type="button" variant="outline" size="sm">
      <PaletteIcon data-icon="inline-start" />
      Creatives
    </Button>
  );
}

export function CatalogToolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <InsightsButton />
      <CreativesButton />
      <VisualizerButton />
      <JobsButton />
      {children}
    </div>
  );
}
