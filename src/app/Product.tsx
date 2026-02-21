import { Navigation } from "./components/Navigation";
import { ProductIntro } from "./components/ProductIntro";
import { CoreLoop } from "./components/CoreLoop";
import { TrainingPhilosophy } from "./components/TrainingPhilosophy";
import { TrainingModes } from "./components/TrainingModes";
import { WhyTheseModesWork } from "./components/WhyTheseModesWork";
import { ProductCTA } from "./components/ProductCTA";

export default function Product() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#5CB3FF]/5 to-white">
      <Navigation currentPage="product" />
      
      <ProductIntro />
      <CoreLoop />
      <TrainingPhilosophy />
      <TrainingModes />
      <WhyTheseModesWork />
      <ProductCTA />

      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p>&copy; 2026 Cognify. A communication training gym.</p>
        </div>
      </footer>
    </div>
  );
}
