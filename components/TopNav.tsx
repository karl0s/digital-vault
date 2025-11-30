import { Search } from 'lucide-react';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function TopNav({ searchQuery, onSearchChange }: TopNavProps) {
  return (
    <nav className="fixed top-0 left-16 right-0 z-40 bg-gradient-to-b from-black to-transparent">
      <div className="flex items-center justify-center px-8 py-4">
        {/* Centered search bar */}
        <div className="relative group">
          <input
            type="text"
            placeholder="Search... (Try: artist:pearl jam, song:alive, type:soundboard)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-black/70 border border-white/20 text-white placeholder-gray-400 rounded px-4 py-2 pl-10 w-96 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          
          {/* Search hint tooltip */}
          <div className="absolute top-full right-0 mt-2 bg-black/95 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400 w-72 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none">
            <div className="mb-1 text-white">Field filters:</div>
            <div className="space-y-0.5 font-mono">
              <div><span className="text-gray-500">artist:</span> pearl jam</div>
              <div><span className="text-gray-500">song:</span> alive</div>
              <div><span className="text-gray-500">type:</span> soundboard</div>
              <div><span className="text-gray-500">country:</span> usa</div>
              <div><span className="text-gray-500">year:</span> 1999</div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}