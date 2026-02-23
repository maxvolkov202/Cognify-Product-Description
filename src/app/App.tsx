import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RepsProvider, useReps } from "../context/RepsContext";
import { AppLayout } from "./layouts/AppLayout";
import { AppHome } from "./pages/AppHome";
import { HistoryPage } from "./pages/HistoryPage";
import { RepDetailPage } from "./pages/RepDetailPage";
import HomePage from "./HomePage";
import Product from "./Product";
import UseCases from "./UseCases";
import HowItWorks from "./HowItWorks";
import About from "./About";
import LogIn from "./LogIn";
import SignUp from "./SignUp";
import TryItOut from "./TryItOut";
import TryItOut2 from "./v2/TryItOut2";

import { ScrollToTop } from "./components/ScrollToTop";

// Wrapper component for marketing pages layout
function MarketingPageWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AppContent() {
  const { session } = useAuth();
  const { repHistory } = useReps();

  return (
    <Routes>
      {/* Marketing Pages */}
      <Route
        path="/"
        element={
          <MarketingPageWrapper>
            <HomePage />
          </MarketingPageWrapper>
        }
      />
      <Route
        path="/product"
        element={
          <MarketingPageWrapper>
            <Product />
          </MarketingPageWrapper>
        }
      />
      <Route
        path="/use-cases"
        element={
          <MarketingPageWrapper>
            <UseCases />
          </MarketingPageWrapper>
        }
      />
      <Route
        path="/how-it-works"
        element={
          <MarketingPageWrapper>
            <HowItWorks />
          </MarketingPageWrapper>
        }
      />
      <Route
        path="/about"
        element={
          <MarketingPageWrapper>
            <About />
          </MarketingPageWrapper>
        }
      />
      <Route
        path="/login"
        element={
          <MarketingPageWrapper>
            <LogIn />
          </MarketingPageWrapper>
        }
      />
      <Route
        path="/signup"
        element={
          <MarketingPageWrapper>
            <SignUp />
          </MarketingPageWrapper>
        }
      />

      {/* App Pages - New Layout with Context */}
      <Route
        path="/app"
        element={
          session ? (
            <AppLayout context={{ reps: repHistory }} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<AppHome />} />
        <Route path="rep" element={<TryItOut2 />} />
        <Route path="try-it-out-v2" element={<TryItOut2 />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="reps/:id" element={<RepDetailPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <RepsProvider>
        <AppContent />
      </RepsProvider>
    </BrowserRouter>
  );
}
