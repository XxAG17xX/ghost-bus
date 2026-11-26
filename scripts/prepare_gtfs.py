# prepare_gtfs.py
# the tfi timetable (gtfs) is 800 MB when unzipped, way too big for my app.
# this script picks out only what my app needs and saves it as small files:
#   stops.json          every stop: stop id -> [name, lat, lon]
#   routes.json         every route: route id -> [the number people see, the bus company]
#   r/<route id>.json   one file per route, with the line on the map and the stops in order, for each direction
#                       (a few route ids have a "/" in them, which can't be in a file name, so it becomes "~")
# run it like this:  python prepare_gtfs.py <the gtfs zip> <output folder>
# my output folder is ghost-bus/public/gtfs, so the app can load the files

import csv
import io
import json
import math
import os
import sys
import zipfile

gtfs = zipfile.ZipFile(sys.argv[1])
out = sys.argv[2]
os.makedirs(out + "/r", exist_ok=True)  # make the output folders first, if they're not there yet


# opens one file inside the zip and gives back its rows one by one,
# so the big files (shapes is 306 MB, stop_times is 486 MB) are never loaded all at once
def read_rows(name):
    file = gtfs.open(name)
    return csv.DictReader(io.TextIOWrapper(file, "utf-8-sig"))


# straight line distance in metres between two points (haversine, same as my app)
def metres(lat1, lon1, lat2, lon2):
    r = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# 1. stops
stops = {}
for row in read_rows("stops.txt"):
    stops[row["stop_id"]] = [row["stop_name"], round(float(row["stop_lat"]), 6), round(float(row["stop_lon"]), 6)]
with open(out + "/stops.json", "w", encoding="utf-8") as f:
    json.dump(stops, f)
print("stops:", len(stops))

# 2. routes
routes = {}
for row in read_rows("routes.txt"):
    routes[row["route_id"]] = [row["route_short_name"], row["agency_id"]]
with open(out + "/routes.json", "w", encoding="utf-8") as f:
    json.dump(routes, f)
print("routes:", len(routes))

# 3. a route can have a few slightly different shapes (like a short version at night),
# so for each route and direction i count which shape the trips use, and keep the most used one.
# i also keep one trip with that shape, to get the stops in order later
shape_counts = {}  # (route, direction) -> {shape id: how many trips use it}
for row in read_rows("trips.txt"):
    key = (row["route_id"], row["direction_id"])
    if key not in shape_counts:
        shape_counts[key] = {}
    shape_counts[key][row["shape_id"]] = shape_counts[key].get(row["shape_id"], 0) + 1

main_shape = {}  # (route, direction) -> the most used shape id
for key in shape_counts:
    main_shape[key] = max(shape_counts[key], key=shape_counts[key].get)

example_trip = {}  # (route, direction) -> one trip that uses the main shape
for row in read_rows("trips.txt"):
    key = (row["route_id"], row["direction_id"])
    if key not in example_trip and row["shape_id"] == main_shape[key]:
        example_trip[key] = row["trip_id"]
print("routes x directions:", len(main_shape))

# 4. the points of only those shapes
wanted_shapes = set(main_shape.values())
shape_points = {}  # shape id -> list of (order, lat, lon)
for row in read_rows("shapes.txt"):
    if row["shape_id"] in wanted_shapes:
        if row["shape_id"] not in shape_points:
            shape_points[row["shape_id"]] = []
        shape_points[row["shape_id"]].append((int(row["shape_pt_sequence"]), float(row["shape_pt_lat"]), float(row["shape_pt_lon"])))

# 5. the stops of only those example trips, in order
wanted_trips = set(example_trip.values())
trip_stops = {}  # trip id -> list of (order, stop id)
for row in read_rows("stop_times.txt"):
    if row["trip_id"] in wanted_trips:
        if row["trip_id"] not in trip_stops:
            trip_stops[row["trip_id"]] = []
        trip_stops[row["trip_id"]].append((int(row["stop_sequence"]), row["stop_id"]))

# 6. one file per route. to keep the files small i only keep a shape point if it's at least 10 m
# from the last point i kept, which is still plenty for drawing the line on a map
route_files = {}
points_before = 0
points_after = 0
for key in main_shape:
    route_id, direction = key
    points = sorted(shape_points[main_shape[key]])
    line = []
    for order, lat, lon in points:
        if len(line) == 0 or metres(line[-1][1], line[-1][0], lat, lon) >= 10 or (order, lat, lon) == points[-1]:
            line.append([round(lon, 6), round(lat, 6)])  # [lon, lat], the order maps use
    points_before += len(points)
    points_after += len(line)
    stops_in_order = [stop_id for order, stop_id in sorted(trip_stops[example_trip[key]])]
    if route_id not in route_files:
        route_files[route_id] = {"id": route_id, "name": routes[route_id][0], "agency": routes[route_id][1], "directions": {}}
    route_files[route_id]["directions"][direction] = {"shape": line, "stops": stops_in_order}

for route_id in route_files:
    with open(out + "/r/" + route_id.replace("/", "~") + ".json", "w", encoding="utf-8") as f:
        json.dump(route_files[route_id], f)
print("route files:", len(route_files), "| shape points", points_before, "->", points_after)
