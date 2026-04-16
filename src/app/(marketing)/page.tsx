import { Hero } from "@/components/marketing/Hero";
import { StatsBar } from "@/components/marketing/StatsBar";
import { ModesSection } from "@/components/marketing/ModesSection";
import { FeedbackSampleCard } from "@/components/marketing/FeedbackSampleCard";
import { ProgressChartMock } from "@/components/marketing/ProgressChartMock";
import { CompetitorTable } from "@/components/marketing/CompetitorTable";
import { PillarsSection } from "@/components/marketing/PillarsSection";
import { EnterpriseCTA } from "@/components/marketing/EnterpriseCTA";
import { FinalCTA } from "@/components/marketing/FinalCTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBar />
      <ModesSection />
      <FeedbackSampleCard />
      <ProgressChartMock />
      <CompetitorTable />
      <PillarsSection />
      <EnterpriseCTA />
      <FinalCTA />
    </>
  );
}
