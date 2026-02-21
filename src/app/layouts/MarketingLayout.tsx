import { Outlet } from "react-router-dom";
import { Navigation } from "../components/Navigation";

interface MarketingLayoutProps {
  onNavigate: (page: "home" | "product" | "use-cases" | "how-it-works" | "about" | "login" | "signup" | "try-it-out") => void;
}

export function MarketingLayout({ onNavigate }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <Navigation onNavigate={onNavigate} />
      <Outlet />
    </div>
  );
}
