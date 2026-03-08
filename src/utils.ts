import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ZONES = ["Zone Logement", "Zone Bureau"];
export const ELEMENT_TYPES = ["Poteaux", "Voiles", "Voiles périphériques"];
export const STATUS_OPTIONS = ["Non commencé", "En cours", "Terminé"];
