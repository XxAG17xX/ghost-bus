// The CSV columns, in order. Every row from toRow must follow this order.
export const HEADER =
  "time,gps_time,lat,lon,accuracy_m,speed_mps,heading_deg,altitude_m,altitude_accuracy_m";

// the same values as one csv row, but with names, so i can save it in firestore
export type Fix = {
  time: string;
  gps_time: string;
  lat: number;
  lon: number;
  accuracy_m: number;
  speed_mps: number | null; // null means the phone didn't know it
  heading_deg: number | null;
  altitude_m: number | null;
  altitude_accuracy_m: number | null;
};

// turns one position from the phone into one fix, values exactly as the phone gives them
export function toFix(p: GeolocationPosition): Fix {
  const c = p.coords; //i wont be calling p.coords 9 times, so i will call it c instead
  return {
    time: new Date().toISOString(), // time: when this page recorded it
    gps_time: new Date(p.timestamp).toISOString(), // gps_time: when the phone took the fix
    lat: c.latitude,
    lon: c.longitude,
    accuracy_m: c.accuracy,
    speed_mps: c.speed, // the phone may not know these, so they can be null
    heading_deg: c.heading,
    altitude_m: c.altitude,
    altitude_accuracy_m: c.altitudeAccuracy,
  };
}

// turns one fix into one line of the CSV, so the csv and the cloud have the exact same values
export function toRow(f: Fix): string {
  return [
    f.time,
    f.gps_time,
    f.lat,
    f.lon,
    f.accuracy_m,
    f.speed_mps ?? "", // an empty cell when the phone didn't know it
    f.heading_deg ?? "",
    f.altitude_m ?? "",
    f.altitude_accuracy_m ?? "",
  ].join(",");
}
