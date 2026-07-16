"use client";

import { Check, X } from "lucide-react";
import { passwordRequirements } from "@/lib/validation/auth";

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <ul className="grid grid-cols-2 gap-1">
      {passwordRequirements.map((requirement) => {
        const met = requirement.test(password);
        return (
          <li key={requirement.label} className="flex items-center gap-2 text-xs">
            {met ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <X className="h-3.5 w-3.5 text-zinc-400" />
            )}
            <span className={met ? "font-medium text-green-700" : "text-zinc-500"}>
              {requirement.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
