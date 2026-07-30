/*
  The ambient mesh. Three heavily blurred orbs sitting behind everything, so the
  frosted panels have real color to pick up - backdrop-filter over a flat fill
  looks grey and dead, and this is what makes it read as glass instead. Fixed
  and pointer-events-none, so it never interferes with scroll or hit targets,
  and the drift animation is suppressed entirely under prefers-reduced-motion.
*/
export default function Mesh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="animate-mesh-drift absolute -left-[15%] -top-[20%] h-[65vh] w-[65vh] rounded-full blur-[110px]"
        style={{
          background: "rgb(var(--mesh-1) / var(--mesh-alpha))",
          animationDelay: "0s",
        }}
      />
      <div
        className="animate-mesh-drift absolute -right-[10%] top-[10%] h-[55vh] w-[55vh] rounded-full blur-[110px]"
        style={{
          background: "rgb(var(--mesh-2) / var(--mesh-alpha))",
          animationDelay: "-9s",
        }}
      />
      <div
        className="animate-mesh-drift absolute bottom-[-20%] left-[25%] h-[60vh] w-[60vh] rounded-full blur-[120px]"
        style={{
          background: "rgb(var(--mesh-3) / calc(var(--mesh-alpha) * 0.7))",
          animationDelay: "-17s",
        }}
      />
    </div>
  );
}
