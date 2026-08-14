/** Which Escape / uiBack does when settings are closed (CONCEPT §9). */
export type SettingsEscScreen = "garage" | "race" | "menu" | "cup" | "free" | "adhoc" | "results";

/** Garage + race: Esc opens Einstellungen. Other screens: Esc = Zurück zur Garage. */
export function escapeOpensSettings(screen: string): boolean {
  return screen === "garage" || screen === "race";
}
