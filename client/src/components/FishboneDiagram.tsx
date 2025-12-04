import React from 'react';

interface FishboneDiagramProps {
  data: {
    problem: string;
    categories: Array<{
      name: string;
      causes: string[];
    }>;
  };
}

export function FishboneDiagram({ data }: FishboneDiagramProps) {
  const width = 800;
  const height = 400;
  const spineY = height / 2;
  const headX = width - 100;
  const startX = 50;
  
  // Categories position logic (alternating top/bottom)
  // 6 standard categories: Man, Machine, Material, Method, Measurement, Environment
  const categories = data.categories;

  return (
    <div className="w-full overflow-x-auto border rounded-md p-4 bg-white">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Main Spine */}
        <line x1={startX} y1={spineY} x2={headX} y2={spineY} stroke="#333" strokeWidth="3" markerEnd="url(#arrowhead)" />
        
        {/* Head (Problem) */}
        <rect x={headX} y={spineY - 40} width={90} height={80} fill="#f0f0f0" stroke="#333" rx="5" />
        <foreignObject x={headX} y={spineY - 40} width={90} height={80}>
          <div className="flex items-center justify-center h-full p-2 text-xs font-bold text-center break-words">
            {data.problem}
          </div>
        </foreignObject>

        {/* Ribs and Causes */}
        {categories.map((cat, idx) => {
          const isTop = idx % 2 === 0;
          // Distribute along the spine
          const xPos = startX + (idx * ((headX - startX) / categories.length)) + 50;
          const yEnd = isTop ? 50 : height - 50;
          
          return (
            <g key={idx}>
              {/* Rib */}
              <line x1={xPos} y1={spineY} x2={xPos + 40} y2={yEnd} stroke="#666" strokeWidth="2" />
              
              {/* Category Label Box */}
              <rect x={xPos + 20} y={isTop ? yEnd - 30 : yEnd} width={80} height={30} fill="#e6f3ff" stroke="#0066cc" rx="3" />
              <text x={xPos + 60} y={isTop ? yEnd - 10 : yEnd + 20} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0066cc">
                {cat.name}
              </text>

              {/* Causes */}
              {cat.causes.map((cause, cIdx) => {
                const causeY = isTop 
                  ? yEnd + 30 + (cIdx * 25) 
                  : yEnd - 30 - (cIdx * 25);
                
                // Only draw if it doesn't cross spine
                if ((isTop && causeY < spineY) || (!isTop && causeY > spineY)) {
                   return (
                    <g key={cIdx}>
                      <line x1={xPos + 20 + (cIdx * 5)} y1={causeY} x2={xPos + 80} y2={causeY} stroke="#999" strokeWidth="1" />
                      <text x={xPos + 85} y={causeY + 3} fontSize="9" fill="#333">{cause}</text>
                    </g>
                   );
                }
                return null;
              })}
            </g>
          );
        })}

        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

