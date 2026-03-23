import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface ChartSectionProps {
  yieldPrediction: { month: string; yield: number }[];
  nutrientData: { nutrient: string; value: number }[];
}

export default function ChartSection({
  yieldPrediction,
  nutrientData
}: ChartSectionProps) {
  const EmptyState = ({ message }: { message: string }) => (
    <div className="h-48 rounded-2xl bg-seed-green/5 border border-seed-green/10 flex items-center justify-center text-center px-6 text-xs text-seed-dark/60">
      {message}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="neo-card rounded-3xl p-6">
        <h4 className="text-sm font-semibold mb-3">Yield Prediction</h4>
        {yieldPrediction.length ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yieldPrediction}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="yield" stroke="#2f7d4c" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Real yield prediction is unavailable from image-only review. Add stronger field data or a calibrated model source." />
        )}
      </div>
      <div className="neo-card rounded-3xl p-6">
        <h4 className="text-sm font-semibold mb-3">Soil Nutrient Mix</h4>
        {nutrientData.length ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nutrientData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="nutrient" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey="value" fill="#7a5c3e" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Real nutrient values need lab, sensor, or calibrated soil-test data. They are not being fabricated from the image." />
        )}
      </div>
    </div>
  );
}
