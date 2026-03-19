// apps/web/src/components/agent/InsightCard.tsx
"use client";

interface Insight {
  id: string;
  title: string;
  type: string;
  severity: "LOW" | "MED" | "HIGH";
  confidence: number;
  summary: string;
  evidence: string[];
  recommendedNext: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  MOMENTUM: "📈",
  VOLUME_SPIKE: "⚡",
  ROUTE_QUALITY: "🛣️",
  WHALE_ACTIVITY: "🐋",
  NEW_TOKEN: "✨",
  OTHER: "🔍",
};

const SEVERITY_STYLES: Record<string, string> = {
  LOW:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  MED:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  HIGH: "bg-red-500/10 text-red-400 border-red-500/20",
};

const TYPE_STYLES: Record<string, string> = {
  MOMENTUM:      "bg-green-500/10 text-green-400",
  VOLUME_SPIKE:  "bg-yellow-500/10 text-yellow-400",
  ROUTE_QUALITY: "bg-blue-500/10 text-blue-400",
  WHALE_ACTIVITY:"bg-purple-500/10 text-purple-400",
  NEW_TOKEN:     "bg-pink-500/10 text-pink-400",
  OTHER:         "bg-gray-500/10 text-gray-400",
};

export function InsightCard({ insight, compact = false }: { insight: Insight; compact?: boolean }) {
  const confidence = Math.round(insight.confidence * 100);
  const timeAgo = getTimeAgo(insight.createdAt);

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-5 card-glow transition-all hover:border-dark-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{TYPE_ICONS[insight.type] || "🔍"}</span>
          <h3 className="font-semibold text-white text-sm leading-tight truncate">{insight.title}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_STYLES[insight.severity]}`}
          >
            {insight.severity}
          </span>
        </div>
      </div>

      {/* Type + confidence */}
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-md font-mono ${TYPE_STYLES[insight.type]}`}>
          {insight.type.replace("_", " ")}
        </span>
        <div className="flex items-center gap-1.5 flex-1">
          <div className="flex-1 bg-dark-600 rounded-full h-1.5 max-w-[120px]">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-[#14F195] to-[#9945FF] transition-all"
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 font-mono">{confidence}%</span>
        </div>
        <span className="text-xs text-gray-600">{timeAgo}</span>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-300 mb-3 leading-relaxed">{insight.summary}</p>

      {/* Evidence */}
      {!compact && insight.evidence?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evidence</p>
          <ul className="space-y-1">
            {insight.evidence.slice(0, 3).map((e, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                <span className="text-[#14F195] mt-0.5 flex-shrink-0">›</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended next */}
      <div className="bg-dark-600/50 rounded-lg px-3 py-2 border border-dark-500">
        <span className="text-xs text-gray-500">Recommended: </span>
        <span className="text-xs text-[#14F195]">{insight.recommendedNext}</span>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
