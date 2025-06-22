import ScoreComponent from "@/components/Score/Score";

export default function ScorePage() {
  return (
    <div className="p-4 min-h-screen flex items-stretch justify-center overflow-auto md:h-screen">
      <div className="w-full h-[calc(100vh-56px)] md:h-full">
        <ScoreComponent />
      </div>
    </div>
  );
} 