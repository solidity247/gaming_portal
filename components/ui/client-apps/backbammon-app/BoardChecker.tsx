export default function BoardChecker({ color }: { color: "w" | "b" }) {
  const bgColor = color === "w" ? "bg-white" : "bg-black";
  return (
    <div
      className={`${bgColor} rounded-full border border-gray-700`}
      style={{
        width: 16,
        height: 16,
      }}
    />
  );
}
