import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { Mail, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function LogIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate("/app");
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#5CB3FF]/5 to-white">
      <Navigation currentPage="login" />
      
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side - Branding */}
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold tracking-tight">
                Welcome back
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed">
                Continue building clarity and confidence through structured practice.
              </p>

              <div className="bg-gradient-to-br from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-2xl p-8 border border-[#9D7BF5]/30 space-y-4">
                <p className="text-gray-700 font-medium">
                  "Cognify transformed how I communicate in high-pressure situations. The structured reps made all the difference."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                  <div>
                    <p className="font-semibold text-gray-900">Sarah Chen</p>
                    <p className="text-sm text-gray-600">Product Manager</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Log In Form */}
            <div className="bg-white rounded-3xl p-10 shadow-2xl border border-gray-100">
              <div className="space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold">Log in to your account</h2>
                  <p className="text-gray-600">Pick up where you left off</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent outline-none transition-all"
                        placeholder="you@example.com"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <a href="#" className="text-sm text-[#9D7BF5] hover:text-[#8B6BE0] transition-colors">
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent outline-none transition-all"
                        placeholder="Enter your password"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-[#9D7BF5] focus:ring-[#9D7BF5] border-gray-300 rounded"
                      disabled={loading}
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                      Remember me
                    </label>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:pointer-events-none"
                  >
                    {loading ? "Logging in..." : "Log In"}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={() => { navigate("/signup"); window.scrollTo(0, 0); }}
                    className="text-[#9D7BF5] font-medium hover:text-[#8B6BE0] transition-colors"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p>&copy; 2026 Cognify. A communication training gym.</p>
        </div>
      </footer>
    </div>
  );
}
