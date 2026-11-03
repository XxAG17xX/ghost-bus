// The CSV columns, in order. Every row from toRow must follow this order.
export const HEADER =
  "time,gps_time,lat,lon,accuracy_m,speed_mps,heading_deg,altitude_m,altitude_accuracy_m";

// Turn one position from the phone into one line of the CSV, values exactly as the phone gives them.
export function toRow(p: GeolocationPosition): string {
  const c = p.coords; //i wont be calling p.coords 9 times, so i will call it c instead
  return [
    new Date().toISOString(), // time: when this page recorded it
    new Date(p.timestamp).toISOString(), // gps_time: when the phone took the fix
    c.latitude,
    c.longitude,
    c.accuracy,
    c.speed ?? "", // the phone may not know these, so they can be null
    c.heading ?? "",
    c.altitude ?? "",
    c.altitudeAccuracy ?? "",
  ].join(",");
}
