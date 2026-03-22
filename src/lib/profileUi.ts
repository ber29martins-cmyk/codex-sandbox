export type PatientProfile = "adulto" | "pediatria";

export const PROFILE_UI_TOKENS = {
  activeBackground: "#DBEAFE",
  activeText: "#1E3A8A",
  activeBorder: "#93C5FD",
  inactiveBackground: "#FFFFFF",
  inactiveText: "#334155",
  inactiveBorder: "#CBD5E1",
  focusRing: "#60A5FA",
  focusBorder: "#2563EB"
} as const;

export function getProfileDisplayName(profile: PatientProfile) {
  return profile === "pediatria" ? "Pediatria" : "Adulto";
}

export function getProfileContextLabel(profile: PatientProfile) {
  return `Contexto ativo: ${getProfileDisplayName(profile)}`;
}

export function getProfileSwitchFeedback(profile: PatientProfile) {
  return `Perfil alterado para ${getProfileDisplayName(profile)}`;
}

export function getProfileSegmentStyle(profile: PatientProfile, option: PatientProfile) {
  const isActive = profile === option;
  return {
    background: isActive ? PROFILE_UI_TOKENS.activeBackground : PROFILE_UI_TOKENS.inactiveBackground,
    color: isActive ? PROFILE_UI_TOKENS.activeText : PROFILE_UI_TOKENS.inactiveText,
    borderColor: isActive ? PROFILE_UI_TOKENS.activeBorder : PROFILE_UI_TOKENS.inactiveBorder,
    fontWeight: isActive ? 700 : 600
  } as const;
}
