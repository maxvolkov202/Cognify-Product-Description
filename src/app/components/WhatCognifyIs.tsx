export function WhatCognifyIs() {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-[#5CB3FF]/5 to-white">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-8">
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            A gym for communication
          </h2>
          
          <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
            <p>
              Cognify treats communication like a performance skill.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-6 bg-white rounded-2xl border border-gray-200">
                <p className="font-medium text-gray-900">Not content to consume.</p>
              </div>
              <div className="text-center p-6 bg-white rounded-2xl border border-gray-200">
                <p className="font-medium text-gray-900">Not scripts to memorize.</p>
              </div>
              <div className="text-center p-6 bg-white rounded-2xl border border-gray-200">
                <p className="font-medium text-gray-900">Not theory to understand.</p>
              </div>
            </div>

            <p className="text-2xl font-semibold text-gray-900 text-center py-6">
              But reps.
            </p>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-4">
              <p>You select real scenarios.</p>
              <p>You speak out loud under time constraints.</p>
              <p>You receive structured feedback.</p>
              <p>You repeat.</p>
            </div>

            <div className="space-y-4 pt-4">
              <p className="font-medium text-gray-900">Clarity becomes automatic.</p>
              <p className="font-medium text-gray-900">Confidence becomes a byproduct of competence.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
