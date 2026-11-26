# prepare_times.py
# the stop board needs the timetable time of every trip at every stop, because the nta only sends delays
# (board time = timetable time + delay). stop_times.txt is 486 MB, so this keeps only:
#   - dublin bus and go-ahead routes (agency 1 and 3)
#   - trips that run between 26 nov and 20 dec 2026 (the demo is before that)
# and writes one small file per route:
#   t/<route id>.json   {"stops": {"p0": [[seq, stop id], ...]}, "trips": {trip id: ["p0", [seconds after midnight, ...]]}}
#   stop_routes.json    stop id -> the route ids that stop there
# trips with the same stops in the same order share one "pattern" (p0, p1...) so the stop ids aren't repeated
# run it like this:  python prepare_times.py <the gtfs zip> <output folder>

import csv
import datetime
import io
import json
import os
import sys
import zipfile

gtfs = zipfile.ZipFile(sys.argv[1])
out = sys.argv[2]
os.makedirs(out + "/t", exist_ok=True)


def read_rows(name):
    return csv.DictReader(io.TextIOWrapper(gtfs.open(name), "utf-8-sig"))


def day(text):  # "20261126" -> a date
    return datetime.date(int(text[:4]), int(text[4:6]), int(text[6:]))


# 1. which services run on at least one day between 26 nov and 20 dec
first, last = datetime.date(2026, 11, 26), datetime.date(2026, 12, 20)
weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
running = set()
for row in read_rows("calendar.txt"):
    d = max(first, day(row["start_date"]))
    while d <= min(last, day(row["end_date"])):
        if row[weekdays[d.weekday()]] == "1":
            running.add(row["service_id"])
            break
        d += datetime.timedelta(days=1)
for row in read_rows("calendar_dates.txt"):
    if row["exception_type"] == "1" and first <= day(row["date"]) <= last:
        running.add(row["service_id"])

# 2. the dublin trips that run in those weeks
dublin_routes = set()
for row in read_rows("routes.txt"):
    if row["agency_id"] in ("1", "3"):
        dublin_routes.add(row["route_id"])
trip_route = {}  # trip id -> route id
for row in read_rows("trips.txt"):
    if row["route_id"] in dublin_routes and row["service_id"] in running:
        trip_route[row["trip_id"]] = row["route_id"]
print("trips kept:", len(trip_route))

# 3. their stop times (the big file, read row by row)
times = {}  # trip id -> list of (seq, stop id, seconds)
for row in read_rows("stop_times.txt"):
    if row["trip_id"] in trip_route:
        h, m, s = row["arrival_time"].split(":")  # can be over 24, like 25:10:00 after midnight
        seconds = int(h) * 3600 + int(m) * 60 + int(s)
        times.setdefault(row["trip_id"], []).append((int(row["stop_sequence"]), row["stop_id"], seconds))

# 4. one file per route, with shared stop patterns
files = {}
stop_routes = {}
for trip_id, rows in times.items():
    rows.sort()
    route_id = trip_route[trip_id]
    f = files.setdefault(route_id, {"stops": {}, "trips": {}, "lookup": {}})
    pattern = tuple((seq, stop) for seq, stop, _ in rows)
    if pattern not in f["lookup"]:
        name = "p" + str(len(f["lookup"]))
        f["lookup"][pattern] = name
        f["stops"][name] = [list(p) for p in pattern]
    f["trips"][trip_id] = [f["lookup"][pattern], [seconds for _, _, seconds in rows]]
    for _, stop, _ in rows:
        stop_routes.setdefault(stop, set()).add(route_id)

for route_id, f in files.items():
    del f["lookup"]
    with open(out + "/t/" + route_id.replace("/", "~") + ".json", "w", encoding="utf-8") as file:
        json.dump(f, file, separators=(",", ":"))
with open(out + "/stop_routes.json", "w", encoding="utf-8") as file:
    json.dump({stop: sorted(routes) for stop, routes in stop_routes.items()}, file, separators=(",", ":"))
print("route files:", len(files), "| stops:", len(stop_routes))
