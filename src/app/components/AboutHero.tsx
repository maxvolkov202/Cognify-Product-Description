export function AboutHero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight">
              Why Cognify exists
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Cognify was built to solve a simple but overlooked problem:<br />
              smart people struggle to communicate clearly under pressure.
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-3xl p-12 border border-[#9D7BF5]/30 flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="w-32 h-32 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mx-auto flex items-center justify-center">
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center">
                  <span className="text-4xl font-bold bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] bg-clip-text text-transparent">C</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 italic">Building clarity through structure</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
