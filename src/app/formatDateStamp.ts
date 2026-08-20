export function formatDateStamp(date: Date): { label: string; dateTime: string } {
  const dateTime = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);

  const labelParts = new Map(parts.map((part) => [part.type, part.value]));
  const label = [
    labelParts.get("weekday"),
    labelParts.get("day"),
    labelParts.get("month"),
    labelParts.get("year"),
  ].join(" ");

  return { label, dateTime };
}
