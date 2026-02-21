import { useNavigate } from "react-router-dom";

export function UseCasesCTA() {
  const navigate = useNavigate();
  return (
    <section className="py-32 px-6">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
          Start training for your situation
        </h2>
        
        <p className="text-lg text-gray-600">
          Practice the moments that matter in your role
        </p>

        <div className="space-y-3">
          <div>
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="px-8 py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-full text-lg font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5"
            >
              Try the communication gym
            </button>
          </div>
          <p className="text-sm text-gray-500">Choose your scenario and start your first rep</p>
        </div>
      </div>
    </section>
  );
}
