import { Navigation } from "./components/Navigation";
import { HowItWorksHero } from "./components/HowItWorksHero";
import { Step1Configure } from "./components/Step1Configure";
import { Step2Record } from "./components/Step2Record";
import { Step3Feedback } from "./components/Step3Feedback";
import { Step4NextFocus } from "./components/Step4NextFocus";
import { Step4Progress } from "./components/Step4Progress";
import { WhySystemWorks } from "./components/WhySystemWorks";
import { HowItWorksCTA } from "./components/HowItWorksCTA";

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation currentPage="how-it-works" />
      
      <HowItWorksHero />
      <Step1Configure />
      <Step2Record />
      <Step3Feedback />
      <Step4NextFocus />
      <Step4Progress />
      <WhySystemWorks />
      <HowItWorksCTA />

      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p>&copy; 2026 Cognify. A communication training gym.</p>
        </div>
      </footer>
    </div>
  );
}
