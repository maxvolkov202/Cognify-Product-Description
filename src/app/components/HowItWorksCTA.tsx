import { useNavigate } from "react-router-dom";

export function HowItWorksCTA() {
  const navigate = useNavigate();
  return (
    <section className="py-32 px-6 bg-gradient-to-b from-white to-[#5CB3FF]/5">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-5xl lg:text-6xl font-bold tracking-tight">
          Clarity is a skill. Train it.
        </h2>
        
        <p className="text-xl text-gray-600">
          Start building communication strength through structured reps.
        </p>

        <div className="pt-4">
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="px-10 py-5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-full text-xl font-medium hover:shadow-2xl hover:shadow-purple-500/40 transition-all transform hover:-translate-y-1"
          >
            Start training now
          </button>
        </div>
      </div>
    </section>
  );
}
