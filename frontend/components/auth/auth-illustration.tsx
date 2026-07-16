"use client";

interface AuthIllustrationProps {
  variant: "blobs" | "constellation" | "heart";
}

function OrganicBlobs() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-brandDark">
      {/* Blob 1 - lightGreen */}
      <div
        className="absolute -left-1/4 top-0 h-[70%] w-[70%] rounded-full opacity-20 blur-[120px] animate-float-slow"
        style={{ backgroundColor: "#AEE08F" }}
      />
      {/* Blob 2 - brandBlue */}
      <div
        className="absolute -right-1/4 bottom-0 h-[60%] w-[60%] rounded-full opacity-15 blur-[100px] animate-float-slow-reverse"
        style={{ backgroundColor: "#6EB5F3", animationDelay: "2s" }}
      />
      {/* Blob 3 - darkGreen */}
      <div
        className="absolute left-1/3 top-1/3 h-[50%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[90px] animate-float-slow"
        style={{ backgroundColor: "#417D85", animationDelay: "4s" }}
      />
      {/* Blob 4 - gold accent */}
      <div
        className="absolute right-1/4 top-1/4 h-[30%] w-[30%] rounded-full opacity-8 blur-[80px] animate-float-slow-reverse"
        style={{ backgroundColor: "#D4A853", animationDelay: "1s" }}
      />
    </div>
  );
}

function AgentConstellation() {
  const nodes = [
    { cx: 30, cy: 20, color: "#AEE08F" },
    { cx: 70, cy: 15, color: "#417D85" },
    { cx: 20, cy: 50, color: "#6EB5F3" },
    { cx: 50, cy: 45, color: "#D4A853" },
    { cx: 80, cy: 55, color: "#AEE08F" },
    { cx: 35, cy: 75, color: "#417D85" },
    { cx: 65, cy: 80, color: "#6EB5F3" },
    { cx: 50, cy: 60, color: "#AEE08F" },
  ];

  const connections = [
    [0, 3], [1, 3], [2, 3], [4, 3],
    [0, 2], [1, 4], [2, 5], [3, 7],
    [4, 6], [5, 7], [6, 7], [0, 1],
  ];

  return (
    <div className="flex h-full w-full items-center justify-center bg-brandDark">
      <svg
        viewBox="0 0 100 100"
        className="h-3/4 w-3/4"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Connection lines */}
        {connections.map(([from, to], i) => (
          <line
            key={i}
            x1={nodes[from].cx}
            y1={nodes[from].cy}
            x2={nodes[to].cx}
            y2={nodes[to].cy}
            stroke="currentColor"
            strokeWidth="0.15"
            className="text-offWhite/10"
          />
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <g key={i}>
            {/* Glow */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r="2.5"
              fill={node.color}
              opacity="0.15"
              className="animate-pulse-soft"
              style={{ animationDelay: `${i * 0.5}s` }}
            />
            {/* Core */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r="0.8"
              fill={node.color}
              opacity="0.6"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

function HeartConstellation() {
  // Nodes arranged in a heart shape
  const nodes = [
    { cx: 50, cy: 15, color: "#AEE08F" },
    { cx: 35, cy: 25, color: "#417D85" },
    { cx: 65, cy: 25, color: "#6EB5F3" },
    { cx: 25, cy: 40, color: "#D4A853" },
    { cx: 50, cy: 35, color: "#AEE08F" },
    { cx: 75, cy: 40, color: "#417D85" },
    { cx: 30, cy: 55, color: "#6EB5F3" },
    { cx: 50, cy: 50, color: "#D4A853" },
    { cx: 70, cy: 55, color: "#AEE08F" },
    { cx: 40, cy: 70, color: "#417D85" },
    { cx: 60, cy: 70, color: "#6EB5F3" },
    { cx: 50, cy: 85, color: "#D4A853" },
  ];

  const connections = [
    [0, 1], [0, 2], [1, 3], [2, 5], [1, 4], [2, 4],
    [3, 6], [5, 8], [4, 7], [6, 9], [8, 10], [7, 9], [7, 10],
    [9, 11], [10, 11],
  ];

  return (
    <div className="flex h-full w-full items-center justify-center bg-brandDark">
      <svg
        viewBox="0 0 100 100"
        className="h-3/4 w-3/4"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Connection lines */}
        {connections.map(([from, to], i) => (
          <line
            key={i}
            x1={nodes[from].cx}
            y1={nodes[from].cy}
            x2={nodes[to].cx}
            y2={nodes[to].cy}
            stroke="currentColor"
            strokeWidth="0.12"
            className="text-offWhite/10"
          />
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <g key={i}>
            {/* Glow */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r="2"
              fill={node.color}
              opacity="0.15"
              className="animate-pulse-soft"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
            {/* Core */}
            <circle
              cx={node.cx}
              cy={node.cy}
              r="0.7"
              fill={node.color}
              opacity="0.6"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function AuthIllustration({ variant }: AuthIllustrationProps) {
  if (variant === "blobs") {
    return <OrganicBlobs />;
  }
  if (variant === "heart") {
    return <HeartConstellation />;
  }
  return <AgentConstellation />;
}
