import { useNavigate } from "react-router-dom";
import { ProductPreview } from "./ProductPreview";

export function Hero() {
  const navigate = useNavigate();

  const handleStartClick = () => {
    navigate("/signup");
    window.scrollTo(0, 0);
  };

  const handleHowItWorksClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate("/how-it-works");
    window.scrollTo(0, 0);
  };

  return (
    <section className="pt-20 md:pt-24 pb-12 md:pb-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-5 md:space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] md:leading-tight">
              Train clear thinking into clear speech
            </h1>
            
            <p className="text-base md:text-lg text-gray-600 leading-relaxed md:leading-relaxed max-w-xl">
              Cognify is a communication training gym where you practice real conversations out loud. Through short, structured reps and immediate feedback, you build the ability to organize thoughts and explain ideas clearly under pressure.
            </p>

            <div className="space-y-2 md:space-y-3 pt-1">
              <button 
                onClick={handleStartClick}
                className="w-full md:w-auto px-8 py-3.5 md:py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-full text-base md:text-lg font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5"
              >
                <span className="md:hidden">Start your first rep</span>
                <span className="hidden md:inline">Start training for free</span>
              </button>
              <div className="text-center md:text-left">
                <a 
                  href="#how-it-works" 
                  onClick={handleHowItWorksClick}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  See how the gym works
                </a>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#5CB3FF]/20 via-[#9D7BF5]/20 to-[#E86DE1]/20 rounded-2xl blur-3xl"></div>
            <div className="relative">
              <ProductPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
