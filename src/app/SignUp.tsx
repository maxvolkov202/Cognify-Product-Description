import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { Mail, Lock, User } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { full_name: name } } : undefined,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    navigate("/app");
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#5CB3FF]/5 to-white">
      <Navigation currentPage="signup" />
      
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side - Branding */}
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold tracking-tight">
                Start training your clarity
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed">
                Join Cognify and build communication skills through structured practice and real-time feedback.
              </p>

              <div className="space-y-4 pt-6">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2.5"></div>
                  <p className="text-gray-700">Practice real scenarios under time constraints</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2.5"></div>
                  <p className="text-gray-700">Get immediate, actionable feedback</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2.5"></div>
                  <p className="text-gray-700">Track progress over time</p>
                </div>
              </div>
            </div>

            {/* Right side - Sign Up Form */}
            <div className="bg-white rounded-3xl p-10 shadow-2xl border border-gray-100">
              <div className="space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold">Create your account</h2>
                  <p className="text-gray-600">Start your first rep in under 2 minutes</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent outline-none transition-all"
                        placeholder="Alex Johnson"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

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
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
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
                        placeholder="At least 8 characters"
                        required
                        minLength={8}
                        disabled={loading}
                      />
                    </div>
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
                    {loading ? "Creating account..." : "Create Account"}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => { navigate("/login"); window.scrollTo(0, 0); }}
                    className="text-[#9D7BF5] font-medium hover:text-[#8B6BE0] transition-colors"
                  >
                    Log in
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
