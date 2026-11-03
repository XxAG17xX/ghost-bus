import Recorder from "./Recorder";
export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">Ghost bus recorder</h1>
      <Recorder />
    </main>
  );
}
