import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Clock, User, BookOpen, Volume2, ChevronDown, ChevronUp } from "lucide-react";
import type { RepRow } from "../v2/components/tryitout/ResultsScreen";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export function RepDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [rep, setRep] = useState<RepRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  useEffect(() => {
    const loadRep = async () => {
      if (!id || !session?.user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("reps")
        .select(`
          id,
          transcript,
          transcript_word_count,
          overall_score,
          delivery_score,
          content_score,
          status,
          audio_url,
          vertical,
          scenario,
          audience,
          framework,
          time_limit,
          created_at,
          feedback_good,
          feedback_improve,
          next_focus,
          delivery_scores (*)
        `)
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();

      if (!error && data) {
        setRep(data as RepRow);
      }

      setLoading(false);
    };

    loadRep();
  }, [id, session?.user?.id]);

  if (loading) {
    return <div className="p-12 text-center">Loading...</div>;
  }

  if (!rep) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold">Rep Not Found</h2>
      </div>
    );
  }

  if (rep.status === "processing") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Still Processing</h2>
          <p className="text-gray-600">This rep is still being evaluated. Please check back in a moment.</p>
        </div>
      </div>
    );
  }

  if (rep.status === "failed" || rep.status === "error") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Failed</h2>
          <p className="text-gray-600 mb-4">This rep couldn't be processed.</p>
          <Link
            to="/app/history"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  const overallScore = rep.overall_score ?? 0;

  const performanceLabel =
    overallScore >= 90 ? "Elite" :
    overallScore >= 75 ? "Strong" :
    overallScore >= 60 ? "Developing" :
    "Needs Work";

  const performanceColor =
    overallScore >= 90 ? "text-green-700 bg-green-50 border-green-200" :
    overallScore >= 75 ? "text-blue-700 bg-blue-50 border-blue-200" :
    overallScore >= 60 ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
    "text-red-700 bg-red-50 border-red-200";

  const createdDate = rep.created_at
    ? (() => {
        const d = new Date(rep.created_at);
        return isNaN(d.getTime()) ? null : d;
      })()
    : null;

  // Format in user's local timezone (Supabase stores UTC)
  const formatLocalDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const formatLocalTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  // Normalize delivery_scores: Supabase can return array or single object
  const rawDelivery = rep.delivery_scores;
  const deliveryRow =
    Array.isArray(rawDelivery) && rawDelivery.length > 0
      ? rawDelivery[0]
      : rawDelivery && typeof rawDelivery === "object" && !Array.isArray(rawDelivery)
        ? rawDelivery
        : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/app/history")}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to History
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{rep.scenario ?? "—"}</h1>
      </div>

      {/* Overall Score Card */}
      <div className="bg-gradient-to-br from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 border border-[#9D7BF5]/30 rounded-2xl p-8 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-1">OVERALL SCORE</h2>
            <div className="flex items-baseline gap-3">
              <div className="text-6xl font-bold text-gray-900">{overallScore}</div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${performanceColor}`}>
                {performanceLabel}
              </div>
            </div>
          </div>
          {createdDate && (
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">
                {formatLocalDate(createdDate)}
              </div>
              <div className="text-xs text-gray-500">
                {formatLocalTime(createdDate)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5 Core Dimensions - from delivery_scores (array or single object) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">5 CORE DIMENSIONS</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <DimensionCard title="Pace" score={(deliveryRow as { pace?: number | null } | null)?.pace ?? 0} insight="Rhythm & timing" color="green" />
          <DimensionCard title="Clarity" score={(deliveryRow as { clarity?: number | null } | null)?.clarity ?? 0} insight="Simple, direct language" color="blue" />
          <DimensionCard title="Confidence" score={(deliveryRow as { confidence?: number | null } | null)?.confidence ?? 0} insight="Assured delivery" color="purple" />
          <DimensionCard title="Pauses" score={(deliveryRow as { pauses?: number | null } | null)?.pauses ?? 0} insight="Effective use of silence" color="orange" />
          <DimensionCard title="Tone" score={(deliveryRow as { tone?: number | null } | null)?.tone ?? 0} insight="Vocal expression" color="pink" />
        </div>
      </div>

      {/* Audio Playback - only if audio_url exists */}
      {rep.audio_url && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Volume2 className="w-5 h-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">AUDIO PLAYBACK</h3>
          </div>
          <audio controls src={rep.audio_url} className="w-full" />
        </div>
      )}

      {/* Coach Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-4">
          COACH INSIGHTS
        </h3>

        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold text-gray-900 mb-1">What Worked</p>
            <p className="text-gray-700">
              {rep.feedback_good ?? "—"}
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-1">Needs Improvement</p>
            <p className="text-gray-700">
              {rep.feedback_improve ?? "—"}
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-1">Next Rep Focus</p>
            <p className="text-gray-700 font-medium">
              {rep.next_focus ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Transcript Section (Collapsible) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <button
          onClick={() => setTranscriptExpanded(!transcriptExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="text-sm font-semibold text-gray-900">TRANSCRIPT</h3>
          {transcriptExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {transcriptExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700 leading-relaxed">{rep.transcript ?? "No transcript."}</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">SESSION DETAILS</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <User className="w-4 h-4" />
              <span>Audience</span>
            </div>
            <div className="font-medium text-gray-900">{rep.audience ?? "—"}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Framework</span>
            </div>
            <div className="font-medium text-gray-900">{rep.framework ?? "—"}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Clock className="w-4 h-4" />
              <span>Time Limit</span>
            </div>
            <div className="font-medium text-gray-900">{rep.time_limit != null ? `${rep.time_limit}s` : "—"}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Calendar className="w-4 h-4" />
              <span>Vertical</span>
            </div>
            <div className="font-medium text-gray-900">{rep.vertical ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={() =>
            navigate("/app/rep", {
              state: {
                carryFocus: rep.next_focus,
                vertical: rep.vertical,
                scenario: rep.scenario,
                audience: rep.audience,
                framework: rep.framework,
                time_limit: rep.time_limit
              }
            })
          }
          className="flex-1 px-6 py-3 bg-gradient-to-r from-[#5CB3FF] to-[#9D7BF5] text-white rounded-lg font-medium text-center hover:shadow-lg transition-all"
        >
          Do Another Rep
        </button>
        <button
          onClick={() => navigate("/app/history")}
          className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
        >
          View All Reps
        </button>
      </div>
    </div>
  );
}

interface DimensionCardProps {
  title: string;
  score: number;
  insight: string;
  color: "blue" | "purple" | "pink" | "green" | "orange";
}

function DimensionCard({ title, score, insight, color }: DimensionCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    purple: "bg-purple-50 border-purple-200 text-purple-900",
    pink: "bg-pink-50 border-pink-200 text-pink-900",
    green: "bg-green-50 border-green-200 text-green-900",
    orange: "bg-orange-50 border-orange-200 text-orange-900"
  };

  const scoreColor =
    score >= 80 ? "text-green-700" :
    score >= 65 ? "text-blue-700" :
    score >= 50 ? "text-yellow-700" :
    "text-red-700";

  return (
    <div className={`rounded-lg border p-4 text-center ${colorClasses[color]}`}>
      <div className={`text-3xl font-bold mb-1 ${scoreColor}`}>{score}</div>
      <div className="text-xs font-semibold mb-1">{title}</div>
      <div className="text-xs opacity-80 leading-tight">{insight}</div>
    </div>
  );
}
