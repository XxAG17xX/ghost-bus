import { signInAnonymously } from "firebase/auth";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Fix } from "./toRow";

// every phone signs in as an anonymous user, so my rules can check the ride is really theirs
async function getUserId() {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  const result = await signInAnonymously(auth);
  return result.user.uid;
}

// makes a new ride in the "rides" collection and gives back its id
// all the fixes of this ride go inside it, in rides/<ride id>/points
export async function startRide(route: string) {
  const userId = await getUserId();
  const ride = doc(collection(db, "rides")); // a new document with a random id, made on the phone itself
  // i don't wait for this one: with no signal it just waits in the cache and the ride still starts
  setDoc(ride, { uid: userId, route: route, startedAt: serverTimestamp() }).catch((e) => {
    console.error("the ride wasn't saved", e);
  });
  return ride.id;
}

// saves one fix in the cloud, and it only finishes once google actually has it,
// thats how the page knows a row is "in cloud"
// savedAt is google's own time, so savedAt minus gps_time shows how real time the upload is
export async function saveFix(rideId: string, fix: Fix) {
  const userId = await getUserId();
  const point = doc(db, "rides", rideId, "points", fix.time); // the time of the fix is its id
  await setDoc(point, { ...fix, uid: userId, savedAt: serverTimestamp() });
}
