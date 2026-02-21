import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { CognifyHeroLogo } from "../../components/branding/CognifyHeroLogo";

type Page = "home" | "product" | "use-cases" | "how-it-works" | "about" | "login" | "signup" | "try-it-out";

const PAGE_TO_PATH: Record<Page, string> = {
  home: "/",
  product: "/product",
  "use-cases": "/use-cases",
  "how-it-works": "/how-it-works",
  about: "/about",
  login: "/login",
  signup: "/signup",
  "try-it-out": "/signup",
};

interface NavigationProps {
  currentPage?: Page;
}

export function Navigation({ currentPage = "home" }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigate = (page: Page) => {
    navigate(PAGE_TO_PATH[page]);
    window.scrollTo(0, 0);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, page: Page) => {
    e.preventDefault();
    handleNavigate(page);
    setMobileMenuOpen(false);
  };

  const handleButtonClick = (page: "login" | "signup" | "try-it-out") => {
    handleNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => handleNavigate("home")}
              className="flex items-center gap-2 sm:gap-3 group focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:ring-offset-2 rounded-lg"
            >
              <div className="hidden md:block">
                <CognifyHeroLogo size={40} />
              </div>
              <div className="block md:hidden">
                <CognifyHeroLogo size={32} />
              </div>
              <span className="text-base md:text-xl font-semibold tracking-tight text-gray-900">
                Cognify
              </span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a 
                href="#product" 
                onClick={(e) => handleNavClick(e, "product")}
                className={`transition-colors ${currentPage === "product" ? "text-gray-900 font-medium" : "text-gray-700 hover:text-gray-900"}`}
              >
                Product
              </a>
              <a 
                href="#use-cases" 
                onClick={(e) => handleNavClick(e, "use-cases")}
                className={`transition-colors ${currentPage === "use-cases" ? "text-gray-900 font-medium" : "text-gray-700 hover:text-gray-900"}`}
              >
                Use Cases
              </a>
              <a 
                href="#how-it-works" 
                onClick={(e) => handleNavClick(e, "how-it-works")}
                className={`transition-colors ${currentPage === "how-it-works" ? "text-gray-900 font-medium" : "text-gray-700 hover:text-gray-900"}`}
              >
                How it works
              </a>
              <a 
                href="#about" 
                onClick={(e) => handleNavClick(e, "about")}
                className={`transition-colors ${currentPage === "about" ? "text-gray-900 font-medium" : "text-gray-700 hover:text-gray-900"}`}
              >
                About
              </a>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <button 
                onClick={() => handleButtonClick('login')}
                className="text-gray-700 hover:text-gray-900 transition-colors"
              >
                Log in
              </button>
              <button 
                onClick={() => handleButtonClick('try-it-out')}
                className="px-6 py-2.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-full hover:shadow-lg hover:shadow-purple-500/30 transition-all"
              >
                Try it out
              </button>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-gray-900"
              aria-label="Toggle menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Slide-In Menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 z-40 md:hidden transition-opacity duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Drawer */}
          <div className="fixed top-0 right-0 bottom-0 w-[80%] bg-white z-50 shadow-2xl md:hidden transition-transform duration-300 ease-out">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <span className="text-lg font-semibold">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-gray-700 hover:text-gray-900"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="flex-1 px-6 py-8 space-y-6 overflow-y-auto">
                <a 
                  href="#product" 
                  onClick={(e) => handleNavClick(e, "product")}
                  className={`block text-lg transition-colors ${currentPage === "product" ? "text-gray-900 font-semibold" : "text-gray-700"}`}
                >
                  Product
                </a>
                <a 
                  href="#use-cases" 
                  onClick={(e) => handleNavClick(e, "use-cases")}
                  className={`block text-lg transition-colors ${currentPage === "use-cases" ? "text-gray-900 font-semibold" : "text-gray-700"}`}
                >
                  Use Cases
                </a>
                <a 
                  href="#how-it-works" 
                  onClick={(e) => handleNavClick(e, "how-it-works")}
                  className={`block text-lg transition-colors ${currentPage === "how-it-works" ? "text-gray-900 font-semibold" : "text-gray-700"}`}
                >
                  How it works
                </a>
                <a 
                  href="#about" 
                  onClick={(e) => handleNavClick(e, "about")}
                  className={`block text-lg transition-colors ${currentPage === "about" ? "text-gray-900 font-semibold" : "text-gray-700"}`}
                >
                  About
                </a>

                <div className="pt-6 border-t border-gray-200">
                  <a 
                    href="#login" 
                    onClick={(e) => handleNavClick(e, "login")}
                    className={`block text-lg transition-colors ${currentPage === "login" ? "text-gray-900 font-semibold" : "text-gray-700"}`}
                  >
                    Log in
                  </a>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="p-6 border-t border-gray-100">
                <button 
                  onClick={() => handleButtonClick('try-it-out')}
                  className="w-full px-6 py-3.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-full hover:shadow-lg hover:shadow-purple-500/30 transition-all font-medium"
                >
                  Try it out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
