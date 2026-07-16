import {
  Apple,
  Dumbbell,
  HeartPulse,
  Brain,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface AgentConfig {
  name: string;
  shortName: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  iconColor: string;
}

export const AGENTS: AgentConfig[] = [
  {
    name: "Nutrition Specialist",
    shortName: "Nutrition",
    icon: Apple,
    color: "bg-emerald-100",
    bgColor: "bg-emerald-50",
    iconColor: "text-emerald-700",
  },
  {
    name: "Fitness Coach Specialist",
    shortName: "Fitness",
    icon: Dumbbell,
    color: "bg-blue-100",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-700",
  },
  {
    name: "Medical Safety Specialist",
    shortName: "Medical",
    icon: HeartPulse,
    color: "bg-red-100",
    bgColor: "bg-red-50",
    iconColor: "text-red-700",
  },
  {
    name: "Behavioral Psychology Specialist",
    shortName: "Behavioral",
    icon: Brain,
    color: "bg-purple-100",
    bgColor: "bg-purple-50",
    iconColor: "text-purple-700",
  },
  {
    name: "Progress Analyst Specialist",
    shortName: "Progress",
    icon: TrendingUp,
    color: "bg-amber-100",
    bgColor: "bg-amber-50",
    iconColor: "text-amber-700",
  },
];

export function getAgentByName(name: string): AgentConfig | undefined {
  return AGENTS.find(
    (agent) =>
      agent.name === name ||
      agent.shortName === name ||
      name.toLowerCase().includes(agent.shortName.toLowerCase())
  );
}
