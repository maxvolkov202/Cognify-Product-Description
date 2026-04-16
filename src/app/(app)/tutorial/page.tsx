import type { Metadata } from "next";
import { TutorialClient } from "@/components/product/TutorialClient";

export const metadata: Metadata = {
  title: "Tutorial · Cognify",
  description:
    "A 4-screen walkthrough of how Cognify works, how scoring works, and what a good rep sounds like.",
};

export default function TutorialPage() {
  return <TutorialClient />;
}
