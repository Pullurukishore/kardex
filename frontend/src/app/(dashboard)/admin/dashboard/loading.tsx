// Premium Skeleton UI for Dashboard Loading
export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#96AEC2]/10 p-2 md:p-4">
      {/* Animated background bubbles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#96AEC2]/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#82A094]/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#CE9F6B]/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
      </div>
      
      <div className="relative z-10 w-full max-w-full">
        {/* Header skeleton */}
        <div className="mb-6 sm:mb-8">
          <div className="h-32 sm:h-40 bg-white/80 border border-[#96AEC2]/20 rounded-2xl sm:rounded-3xl animate-pulse relative overflow-hidden shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#96AEC2] via-[#82A094] to-[#CE9F6B]" />
          </div>
        </div>
        
        {/* Section title skeleton */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl animate-pulse" />
            <div className="h-6 sm:h-8 w-40 sm:w-48 bg-[#AEBFC3]/30 rounded-lg animate-pulse" />
          </div>
          <div className="h-8 w-24 bg-[#82A094]/20 rounded-full animate-pulse" />
        </div>
        
        {/* Executive summary cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div 
              key={i} 
              className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-[#96AEC2]/20 shadow-lg animate-pulse relative overflow-hidden"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6F8A9D] to-[#82A094]" />
              <div className="flex justify-between items-start">
                <div className="space-y-3 flex-1">
                  <div className="h-4 bg-[#AEBFC3]/40 rounded w-2/3" />
                  <div className="h-8 sm:h-10 bg-[#6F8A9D]/20 rounded-lg w-1/2" />
                  <div className="h-3 bg-[#AEBFC3]/30 rounded w-4/5" />
                </div>
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Analytics section skeleton */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 mb-6 shadow-lg border border-[#96AEC2]/20 animate-pulse">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 bg-[#AEBFC3]/40 rounded w-48" />
              <div className="h-4 bg-[#AEBFC3]/30 rounded w-64" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 sm:h-80 bg-[#96AEC2]/10 rounded-xl border border-[#96AEC2]/20" />
            <div className="h-64 sm:h-80 bg-[#82A094]/10 rounded-xl border border-[#82A094]/20" />
          </div>
        </div>

        {/* Recent tickets skeleton */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border border-[#96AEC2]/20 animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-xl" />
              <div className="h-6 bg-[#AEBFC3]/40 rounded w-36" />
            </div>
            <div className="h-8 w-28 bg-[#AEBFC3]/30 rounded-lg" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 sm:h-24 bg-[#AEBFC3]/20 rounded-xl border border-[#AEBFC3]/20" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
