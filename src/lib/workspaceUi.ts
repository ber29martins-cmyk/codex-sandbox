type PatientProfile = "adulto" | "pediatria";

function getProfileDisplayName(profile: PatientProfile) {
  return profile === "pediatria" ? "Pediatria" : "Adulto";
}

type WorkspaceContextInput = {
  profile: PatientProfile;
  templateLabel?: string;
  hmaItemsCount: number;
  hmaPresentCount: number;
  hmaNegCount: number;
  alarmCount: number;
  rxSelectedCount: number;
};

export function buildWorkspaceContextBadges(input: WorkspaceContextInput) {
  return [
    `Perfil: ${getProfileDisplayName(input.profile)}`,
    `Template: ${input.templateLabel?.trim() || "—"}`,
    `HMA: ${input.hmaPresentCount + input.hmaNegCount}/${input.hmaItemsCount}`,
    `Alarmes: ${input.alarmCount}`,
    `RX selecionados: ${input.rxSelectedCount}`
  ];
}
