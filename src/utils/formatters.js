// =====================================================================
// Formatters — mapean datos de la DB (snake_case, enums lowercase)
// a etiquetas y formatos que muestra la UI
// =====================================================================

export const FORMAT_LABELS = {
  mexicano:  "Mexicano",
  americano: "Americano",
  reto:      "Reto",
  torneo:    "Torneo",
};

export const STATUS_LABELS = {
  draft:       "Borrador",
  open:        "Abierto",
  almost_full: "Casi lleno",
  closed:      "Cerrado",
  in_progress: "En curso",
  finished:    "Finalizado",
  cancelled:   "Cancelado",
};

export const STATUS_CLASS = {
  open:        "status-open",
  almost_full: "status-warning",
  closed:      "status-closed",
  in_progress: "status-open",
  finished:    "status-closed",
  cancelled:   "status-closed",
  draft:       "",
};

/** Filtro de género: etiqueta visible y color del badge */
export const GENDER_FILTER_LABELS = {
  any:    null,          // sin badge
  male:   "Masculino",
  female: "Femenino",
  mixed:  "Mixto",
};

export const GENDER_FILTER_CLASS = {
  male:   "gender-male",
  female: "gender-female",
  mixed:  "gender-mixed",
};

export const CATEGORY_OPTIONS = ["AA", "A", "B", "C", "D"];
export const FORMAT_OPTIONS    = ["mexicano", "americano", "reto", "torneo"];

export const CATEGORY_LEVELS = {
  AA: ["AA"],
  A:  ["A+", "A", "A-"],
  B:  ["B+", "B", "B-"],
  C:  ["C+", "C", "C-"],
  D:  ["D+", "D", "D-"],
};

/** "2026-05-06T19:00:00" → "martes 6 de mayo" */
export function formatEventDate(isoString) {
  if (!isoString) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
  }).format(new Date(isoString));
}

/** "2026-05-06T19:00:00" → "7:00 p.m." */
export function formatEventTime(isoString) {
  if (!isoString) return "";
  return new Intl.DateTimeFormat("es-CR", {
    hour:   "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

/** date input "2026-05-06" + time input "19:00" → ISO string */
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

/** ISO → "2026-05-06" para input date */
export function toDateInput(isoString) {
  if (!isoString) return "";
  return isoString.slice(0, 10);
}

/** ISO → "19:00" para input time */
export function toTimeInput(isoString) {
  if (!isoString) return "";
  return isoString.slice(11, 16);
}

/** Capitaliza primera letra */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Iniciales de un nombre completo */
export function getInitials(fullName) {
  if (!fullName) return "?";
  return fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
