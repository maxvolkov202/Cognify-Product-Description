import { useNavigate } from "react-router-dom";

export function FinalCTA() {
  const navigate = useNavigate();
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
          Clarity is a skill. Train it.
        </h2>
        
        <div className="space-y-3">
          <div>
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="px-8 py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-full text-lg font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5"
            >
              Start training now
            </button>
          </div>
          <p className="text-xs text-gray-500">One rep closer to clarity</p>
        </div>
      </div>
    </section>
  );
}
