import { useEffect, useState } from "react";
import { ArrowRight, Loader2, AlertTriangle, Volume2, FileText, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { supabase } from "../../../../lib/supabase";

interface ResultsScreenProps {
  scenario: string;
  repId?: string | null;
  nextRepFocus?: { title: string; nextStep: string } | null;
  onDoAnotherRep: () => void;
  onChangePrompt: () => void;
  onChangeFramework: () => void;
  onChangeAudience: () => void;
}

export type RepRow = {
  id: string;
  transcript: string | null;
  transcript_word_count: number | null;
  overall_score: number | null;
  delivery_score: number | null;
  content_score: number | null;
  status: string;
  audio_url: string | null;
  vertical: string | null;
  scenario: string | null;
  audience: string | null;
  framework: string | null;
  time_limit: number | null;
  created_at?: string;
  feedback_good: string | null;
  feedback_improve: string | null;
  next_focus: string | null;
  delivery_scores?: {
    pace: number | null;
    clarity: number | null;
    confidence: number | null;
    pauses: number | null;
    tone: number | null;
  }[] | null;
};

type DeliveryScoresRow = {
  pace: number;
  clarity: number;
  filler_words: number;
  confidence: number;
  pauses: number;
  tone: number;
  overall_delivery: number;
};

export function ResultsScreen({
  scenario,
  repId,
  nextRepFocus,
  onDoAnotherRep,
  onChangePrompt,
  onChangeFramework,
  onChangeAudience,
}: ResultsScreenProps) {
  const [rep, setRep] = useState<RepRow | null>(null);
  const [deliveryScores, setDeliveryScores] = useState<DeliveryScoresRow | null>(null);
  const [loading, setLoading] = useState(!!repId);
  const [error, setError] = useState<string | null>(null);
  const [audioSignedUrl, setAudioSignedUrl] = useState<string | null>(null);
  const [audioUrlLoading, setAudioUrlLoading] = useState(false);
  const [audioUrlError, setAudioUrlError] = useState(false);

  const loadDeliveryScores = async (id: string) => {
    const { data: deliveryData, error: deliveryErr } = await supabase
      .from("delivery_scores")
      .select("pace, clarity, filler_words, confidence, pauses, tone, overall_delivery")
      .eq("rep_id", id)
      .maybeSingle();
    if (!deliveryErr) {
      setDeliveryScores(deliveryData as DeliveryScoresRow | null);
    }
  };

  useEffect(() => {
    if (!repId) return;
    let cancelled = false;

    (async () => {
      const { data: repData, error: repErr } = await supabase
        .from("reps")
        .select("*")
        .eq("id", repId)
        .single();

      if (cancelled) return;
      if (repErr) {
        setError(repErr.message);
        setLoading(false);
        return;
      }
      if (!repData) {
        setError("Rep not found");
        setLoading(false);
        return;
      }

      setRep(repData as RepRow);

      if (repData.status === "failed") {
        setError("Scoring failed");
        setLoading(false);
        return;
      }

      if (repData.status === "completed") {
        await loadDeliveryScores(repId);
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(false);
    })();
  }, [repId]);

  useEffect(() => {
    if (!repId) return;

    const channel = supabase
      .channel(`rep-${repId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reps",
          filter: `id=eq.${repId}`,
        },
        (payload) => {
          const updatedRep = payload.new as RepRow;

          if (updatedRep.status === "completed") {
            setRep(updatedRep);
            loadDeliveryScores(repId);
            setLoading(false);
          }

          if (updatedRep.status === "failed") {
            setError("Rep processing failed.");
            setLoading(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [repId]);

  useEffect(() => {
    if (!rep || rep.status !== "completed" || !rep.audio_url) {
      if (rep?.status === "completed" && !rep?.audio_url) {
        setAudioUrlError(true);
      }
      return;
    }
    let cancelled = false;
    setAudioUrlLoading(true);
    setAudioUrlError(false);
    supabase.storage
      .from("rep-audio")
      .createSignedUrl(rep.audio_url, 3600)
      .then(({ data, error: urlError }) => {
        if (cancelled) return;
        setAudioUrlLoading(false);
        if (urlError || !data?.signedUrl) {
          setAudioUrlError(true);
          return;
        }
        setAudioSignedUrl(data.signedUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setAudioUrlLoading(false);
          setAudioUrlError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rep?.id, rep?.status, rep?.audio_url]);

  if (!repId) {
    return null;
  }

  if (loading || rep?.status === "processing") {
    return (
      <section className="py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-4 py-16">
          <Loader2 className="w-12 h-12 animate-spin text-[#9D7BF5]" />
          <p className="text-gray-600">Scoring your rep...</p>
        </div>
      </section>
    );
  }

  if (error || rep?.status === "failed") {
    return (
      <section className="py-8 px-6">
        <div className="max-w-4xl mx-auto rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Scoring failed</h3>
              <p className="text-sm text-red-800">{error ?? "Something went wrong."}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={onDoAnotherRep}
              className="px-4 py-2 bg-[#9D7BF5] text-white rounded-lg text-sm font-medium hover:bg-[#8B6BE0]"
            >
              Try again
            </button>
            <button
              onClick={onChangePrompt}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Change prompt
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (rep?.status !== "completed" || !rep) {
    return null;
  }

  const overallScore = rep.overall_score ?? 0;
  const deliveryScore = rep.delivery_score ?? 0;
  const contentScore = rep.content_score ?? 0;
  const transcriptText = rep.transcript ?? "";
  const wordCount = rep.transcript_word_count ?? 0;

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Elite";
    if (score >= 75) return "Strong";
    if (score >= 60) return "Developing";
    return "Needs Work";
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 75) return "bg-blue-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const deliveryBreakdown = deliveryScores
    ? [
        { label: "Pace", value: deliveryScores.pace, icon: "⚡" },
        { label: "Clarity", value: deliveryScores.clarity, icon: "💎" },
        { label: "Filler words", value: deliveryScores.filler_words, icon: "🗣️" },
        { label: "Confidence", value: deliveryScores.confidence, icon: "✓" },
        { label: "Pauses", value: deliveryScores.pauses, icon: "⏸" },
        { label: "Tone", value: deliveryScores.tone, icon: "🎵" },
        { label: "Overall delivery", value: deliveryScores.overall_delivery, icon: "📊" },
      ]
    : [];

  return (
    <section className="py-6 px-4 md:px-6">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Section – Rep Summary Card */}
        <div className="bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl p-[2px]">
          <div className="bg-white rounded-[10px] p-5">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Rep Complete</p>
                <h2 className="text-2xl font-bold text-gray-900">{scenario}</h2>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                    {overallScore}
                  </span>
                  <span className="text-xl text-gray-500">/100</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getScoreBadgeColor(overallScore)}`} />
                  <p className={`text-sm font-semibold ${getScoreColor(overallScore)}`}>
                    {getScoreLabel(overallScore)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audio from Supabase Storage */}
        <div className="bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 rounded-xl border border-[#9D7BF5]/20 p-4">
          {audioUrlLoading && (
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-gray-400" />
              Loading audio...
            </p>
          )}
          {!audioUrlLoading && audioUrlError && (
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-gray-400" />
              Audio playback unavailable.
            </p>
          )}
          {!audioUrlLoading && audioSignedUrl && (
            <audio controls src={audioSignedUrl} className="w-full mt-4" />
          )}
        </div>

        {/* Core Scores from reps */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Core Scores</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-2xl mb-1">📊</p>
              <p className={`text-2xl font-bold ${getScoreColor(overallScore)} mb-0.5`}>{overallScore}</p>
              <p className="text-xs text-gray-600">Overall</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-2xl mb-1">🎵</p>
              <p className={`text-2xl font-bold ${getScoreColor(deliveryScore)} mb-0.5`}>{deliveryScore}</p>
              <p className="text-xs text-gray-600">Delivery</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-2xl mb-1">📝</p>
              <p className={`text-2xl font-bold ${getScoreColor(contentScore)} mb-0.5`}>{contentScore}</p>
              <p className="text-xs text-gray-600">Content</p>
            </div>
          </div>
        </div>

        {/* Delivery breakdown from delivery_scores */}
        {deliveryBreakdown.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Delivery breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {deliveryBreakdown.map(({ label, value, icon }) => (
                <div key={label} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className={`text-2xl font-bold ${getScoreColor(value)} mb-0.5`}>{value}</p>
                  <p className="text-xs text-gray-600">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Rep Focus */}
        {nextRepFocus && (
          <div className="bg-[#9D7BF5]/10 border-2 border-[#9D7BF5] rounded-xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-[#9D7BF5]" />
              Next Rep Focus
            </h3>
            <div className="bg-white rounded-lg p-4 border border-[#9D7BF5]/30 space-y-1">
              <p className="text-sm font-semibold text-[#9D7BF5]">{nextRepFocus.title}</p>
              <p className="text-sm text-gray-700">{nextRepFocus.nextStep}</p>
            </div>
          </div>
        )}

        {/* Rep Context */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Rep Context</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-gray-500">Vertical</dt>
              <dd className="font-medium text-gray-900">{rep?.vertical ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Scenario</dt>
              <dd className="font-medium text-gray-900">{rep?.scenario ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Audience</dt>
              <dd className="font-medium text-gray-900">{rep?.audience ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Framework</dt>
              <dd className="font-medium text-gray-900">{rep?.framework ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Time limit</dt>
              <dd className="font-medium text-gray-900">{rep?.time_limit ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Coach Insights */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-4">
            COACH INSIGHTS
          </h3>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-gray-900 mb-1">What Worked</p>
              <p className="text-gray-700">
                {rep?.feedback_good ?? "—"}
              </p>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1">Needs Improvement</p>
              <p className="text-gray-700">
                {rep?.feedback_improve ?? "—"}
              </p>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1">Next Rep Focus</p>
              <p className="text-gray-700 font-medium">
                {rep?.next_focus ?? "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Transcript from reps */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#9D7BF5]" />
              Transcript
            </h3>
            <span className="text-xs text-gray-500">{wordCount} words</span>
          </div>
          <Tabs defaultValue="transcript" className="w-full">
            <TabsList className="w-full grid grid-cols-1 bg-gray-50 rounded-none border-b border-gray-200 p-0">
              <TabsTrigger
                value="transcript"
                className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[#9D7BF5] py-3 font-semibold"
              >
                Transcript
              </TabsTrigger>
            </TabsList>
            <TabsContent value="transcript" className="p-5 m-0">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {transcriptText || "No transcript."}
              </p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onDoAnotherRep}
            className="w-full py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-bold text-base hover:shadow-xl hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
          >
            Do Another Rep
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onChangePrompt}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Change Prompt
            </button>
            <button
              onClick={onChangeFramework}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Change Framework
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
