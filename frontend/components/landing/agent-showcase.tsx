"use client";

import { AGENTS } from "@/lib/agents";

const color = "#417D85";
const bgColor = "bg-darkGreen/15";

export function AgentShowcase() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <div
              key={agent.shortName}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${bgColor}`}
                style={{
                  border: `2px solid ${color}`,
                }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color }}
                />
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: "#1E1E1E", opacity: 0.7 }}
              >
                {agent.shortName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
