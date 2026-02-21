import { Navigation } from "./components/Navigation";
import { UseCasesIntro } from "./components/UseCasesIntro";
import { UseCaseCards } from "./components/UseCaseCards";
import { UseCasesClosing } from "./components/UseCasesClosing";
import { UseCasesCTA } from "./components/UseCasesCTA";

export default function UseCases() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#5CB3FF]/5 to-white">
      <Navigation currentPage="use-cases" />
      
      <UseCasesIntro />
      <UseCaseCards />
      <UseCasesClosing />
      <UseCasesCTA />

      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p>&copy; 2026 Cognify. A communication training gym.</p>
        </div>
      </footer>
    </div>
  );
}
