/**
 * Root-level loading UI displayed while Next.js streams the initial page or any subsequent route segment.
 * Shows a full-screen animated spinner with a "Loading…" label.
 */
export default function RootLoading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white z-[9999]">
      {/* Spinner */}
      <svg
        className="animate-spin h-12 w-12 text-purple-600 mb-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        ></path>
      </svg>
      <span className="text-lg font-semibold tracking-wide">Loading...</span>
    </div>
  );
}
