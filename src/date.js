const cachedDates = {};
const cachedWeekdays = {};

export const SHORTCUTS = {
  months: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

export function toDateString(timestamp) {
  if (!cachedDates[timestamp]) {
    const date = new Date(timestamp);
    cachedDates[timestamp] =
      SHORTCUTS.months[date.getMonth()] + " " + date.getDate();
  }

  return cachedDates[timestamp];
}

export function toWeekday(timestamp) {
  if (!cachedWeekdays[timestamp]) {
    const date = new Date(timestamp);
    cachedWeekdays[timestamp] = "" + SHORTCUTS.weekdays[date.getDay()];
  }

  return cachedWeekdays[timestamp];
}
