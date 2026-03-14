import { ChangeEvent, useEffect, useRef } from "react";

interface ImageUploaderProps {
  imageUrl: string;
  onChange: (value: string) => void;
}

export default function ImageUploader({ imageUrl, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imageUrl && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [imageUrl]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-seed-dark">Field Image Upload</label>
      <div className="border border-dashed border-seed-green/40 rounded-2xl p-4 bg-white/70">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="block w-full text-sm text-seed-dark/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-seed-green/15 file:text-seed-green file:font-medium"
        />
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Field preview"
            className="mt-4 h-40 w-full object-cover rounded-xl"
          />
        ) : (
          <div className="mt-4 text-xs text-seed-dark/50">Upload a drone or mobile image of the field.</div>
        )}
      </div>
    </div>
  );
}
