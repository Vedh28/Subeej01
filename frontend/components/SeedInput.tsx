interface SeedInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SeedInput({ value, onChange }: SeedInputProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-seed-dark">Seed Name</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter seed name"
        className="w-full rounded-2xl border border-seed-green/20 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-seed-green/30"
      />
    </div>
  );
}
