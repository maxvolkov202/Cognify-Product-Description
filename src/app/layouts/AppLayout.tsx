import { useState, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { Flame, Activity, User } from "lucide-react";
import { Rep } from "../types/rep";
import { CognifyHeroLogo } from "../../components/branding/CognifyHeroLogo";
import { supabase } from "../../lib/supabase";

interface AppLayoutContextType {
  reps: Rep[];
}

interface AppLayoutProps {
  context?: AppLayoutContextType;
  disableNavigation?: boolean;
}

type RepSummary = { id: string; completedAt: Date };

export function AppLayout({ context, disableNavigation: disableNavigationProp }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [disableNavInternal, setDisableNavigation] = useState(false);
  const disableNavigation = disableNavigationProp ?? disableNavInternal;
  const [reps, setReps] = useState<RepSummary[]>([]);

  const loadReps = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from("reps")
      .select("id, created_at")
      .eq("user_id", session.user.id);

    if (data) {
      setReps(data.map((r) => ({ id: r.id, completedAt: new Date(r.created_at) })));
    }
  };

  useEffect(() => {
    loadReps();
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      channel = supabase
        .channel("reps-header-updates")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "reps",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            loadReps();
          }
        )
        .subscribe();
    };

    subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  // Calculate today's reps
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysReps = reps.filter(rep => {
    const repDate = new Date(rep.completedAt);
    repDate.setHours(0, 0, 0, 0);
    return repDate.getTime() === today.getTime();
  }).length;

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = new Date(today);
  
  while (true) {
    const hasRepOnDate = reps.some(rep => {
      const repDate = new Date(rep.completedAt);
      repDate.setHours(0, 0, 0, 0);
      return repDate.getTime() === checkDate.getTime();
    });
    
    if (hasRepOnDate) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (currentStreak === 0 && checkDate.getTime() === today.getTime()) {
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* App Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between">
            {/* Left: Logo + Title */}
            <Link
              to="/app"
              onClick={(e) => disableNavigation && e.preventDefault()}
              className="flex items-center gap-3"
              style={disableNavigation ? { pointerEvents: "none", opacity: 0.7 } : undefined}
              aria-disabled={disableNavigation}
            >
              <div className="hidden md:block">
                <CognifyHeroLogo size={40} />
              </div>
              <div className="block md:hidden">
                <CognifyHeroLogo size={32} />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold tracking-tight text-gray-900">
                  Cognify
                </span>
                <span className="text-xs text-gray-500">
                  Communication Gym
                </span>
              </div>
            </Link>

            {/* Center: Navigation */}
            <nav className="flex items-center gap-6">
              <Link
                to="/app/rep"
                onClick={(e) => disableNavigation && e.preventDefault()}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                style={disableNavigation ? { pointerEvents: "none", opacity: 0.7 } : undefined}
                aria-disabled={disableNavigation}
              >
                Perform Rep
              </Link>
              <Link
                to="/app/history"
                onClick={(e) => disableNavigation && e.preventDefault()}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                style={disableNavigation ? { pointerEvents: "none", opacity: 0.7 } : undefined}
                aria-disabled={disableNavigation}
              >
                History
              </Link>
              <button
                type="button"
                disabled={disableNavigation}
                onClick={async () => {
                  if (disableNavigation) return;
                  await supabase.auth.signOut();
                  navigate("/");
                }}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:pointer-events-none disabled:opacity-70"
              >
                Exit Gym
              </button>
            </nav>

            {/* Right: User Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="font-semibold text-gray-900">{currentStreak}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-gray-900">{todaysReps}</span>
                <span className="text-gray-500 text-xs">today</span>
              </div>
              <button className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet context={{ ...context, setDisableNavigation }} />
      </main>
    </div>
  );
}
