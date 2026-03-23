import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, Color, Mesh, RepeatWrapping, SphereGeometry, SRGBColorSpace, Vector2, Vector3 } from "three";
import { getApiUrl } from "../../lib/api-base";

type SeedVisualProfile = {
  shape: "sphere" | "oval" | "flat-oval" | "elongated" | "kidney";
  scale: [number, number, number];
  baseColor: string;
  accentColor: string;
  gloss: number;
  roughness: number;
  speckle: boolean;
};

type SeedVisualResponse = {
  seedName: string;
  summary: {
    matchCount: number;
    topCrop: string;
    topSeedType: string;
    topSeedQuality: string;
  };
  profile: SeedVisualProfile;
};

function buildSeedTexture(baseColor: string, accentColor: string, speckle: boolean) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  const grad = ctx.createRadialGradient(size * 0.3, size * 0.3, 10, size * 0.5, size * 0.5, size * 0.8);
  grad.addColorStop(0, new Color(baseColor).offsetHSL(0, -0.1, 0.18).getStyle());
  grad.addColorStop(1, new Color(baseColor).offsetHSL(0, 0, -0.18).getStyle());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // subtle streaks
  ctx.strokeStyle = new Color(accentColor).offsetHSL(0, -0.1, 0.05).getStyle();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 22; i += 1) {
    const y = (i / 22) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + 6, size * 0.7, y - 6, size, y + 3);
    ctx.stroke();
  }

  // seam hint
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = new Color(accentColor).offsetHSL(0, -0.2, -0.1).getStyle();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(size * 0.1, size * 0.55);
  ctx.bezierCurveTo(size * 0.35, size * 0.45, size * 0.65, size * 0.65, size * 0.9, size * 0.55);
  ctx.stroke();

  // speckles
  if (speckle) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = new Color(accentColor).offsetHSL(0, 0.05, -0.1).getStyle();
    for (let i = 0; i < 600; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  const colorTexture = new CanvasTexture(canvas);
  colorTexture.wrapS = RepeatWrapping;
  colorTexture.wrapT = RepeatWrapping;
  colorTexture.repeat.set(1, 1);
  colorTexture.colorSpace = SRGBColorSpace;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext("2d");
  if (!rctx) return colorTexture;

  rctx.fillStyle = "rgb(190,190,190)";
  rctx.fillRect(0, 0, size, size);
  rctx.globalAlpha = 0.2;
  for (let i = 0; i < 1800; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 140 + Math.random() * 80;
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.fillRect(x, y, 1.5, 1.5);
  }
  rctx.globalAlpha = 0.12;
  rctx.strokeStyle = "rgb(120,120,120)";
  for (let i = 0; i < 20; i += 1) {
    const y = (i / 20) * size;
    rctx.beginPath();
    rctx.moveTo(0, y);
    rctx.bezierCurveTo(size * 0.25, y + 8, size * 0.75, y - 8, size, y + 4);
    rctx.stroke();
  }

  const roughnessTexture = new CanvasTexture(roughCanvas);
  roughnessTexture.wrapS = RepeatWrapping;
  roughnessTexture.wrapT = RepeatWrapping;
  roughnessTexture.repeat.set(1, 1);

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext("2d");
  if (nctx) {
    nctx.fillStyle = "rgb(128,128,255)";
    nctx.fillRect(0, 0, size, size);
    nctx.globalAlpha = 0.25;
    for (let i = 0; i < 1800; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 110 + Math.random() * 35;
      const g = 110 + Math.random() * 35;
      nctx.fillStyle = `rgb(${r},${g},255)`;
      nctx.fillRect(x, y, 1.5, 1.5);
    }
  }
  const normalTexture = new CanvasTexture(normalCanvas);
  normalTexture.wrapS = RepeatWrapping;
  normalTexture.wrapT = RepeatWrapping;
  normalTexture.repeat.set(1, 1);

  return { color: colorTexture, roughness: roughnessTexture, normal: normalTexture };
}

function buildSeedGeometry(profile: SeedVisualProfile) {
  const geometry = new SphereGeometry(0.8, 64, 64);
  const position = geometry.getAttribute("position");
  const temp = new Vector3();

  for (let i = 0; i < position.count; i += 1) {
    temp.fromBufferAttribute(position, i);

    // Base flattening for a more seed-like profile
    temp.y *= 0.88;

    // Kidney/asymmetry bulge
    if (profile.shape === "kidney") {
      const bulge = Math.max(0, temp.x) * 0.18;
      temp.z += bulge;
      temp.x -= Math.max(0, -temp.x) * 0.08;
    }

    // Elongation bias
    if (profile.shape === "elongated") {
      temp.x *= 1.12;
      temp.z *= 0.92;
    }

    // Micro pitting
    const noise =
      Math.sin((temp.x + 1.3) * 8.5) * Math.cos((temp.y + 0.2) * 9.1) * Math.sin((temp.z + 0.7) * 7.8);
    const pit = noise * 0.015;
    temp.addScaledVector(temp.clone().normalize(), pit);

    // Hilum dent (subtle crater)
    const hilumCenter = new Vector3(0.2, -0.15, 0.18);
    const d = temp.distanceTo(hilumCenter);
    if (d < 0.18) {
      const dent = (0.18 - d) * 0.12;
      temp.addScaledVector(temp.clone().normalize(), -dent);
    }

    // Seed coat crack ridge
    const crack = Math.sin((temp.x + 0.4) * 10.2) * 0.008;
    if (temp.y > 0.2 && temp.z > 0.1) {
      temp.addScaledVector(temp.clone().normalize(), crack);
    }

    position.setXYZ(i, temp.x, temp.y, temp.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function SeedMesh({ profile, crop }: { profile: SeedVisualProfile; crop: string }) {
  const meshRef = useRef<Mesh>(null);
  const accentRef = useRef<Mesh>(null);
  const texture = useMemo(
    () => buildSeedTexture(profile.baseColor, profile.accentColor, profile.speckle),
    [profile.baseColor, profile.accentColor, profile.speckle]
  );
  const geometry = useMemo(() => buildSeedGeometry(profile), [profile.shape]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.003;
    }
    if (accentRef.current) {
      accentRef.current.rotation.y += 0.008;
      accentRef.current.rotation.x += 0.002;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} castShadow scale={profile.scale} geometry={geometry}>
        <meshPhysicalMaterial
          color={profile.baseColor}
          roughness={profile.roughness}
          metalness={profile.gloss}
          clearcoat={0.35}
          clearcoatRoughness={0.45}
          sheen={0.25}
          sheenRoughness={0.6}
          map={texture && "color" in texture ? texture.color : undefined}
          roughnessMap={texture && "roughness" in texture ? texture.roughness : undefined}
          bumpMap={texture && "roughness" in texture ? texture.roughness : undefined}
          bumpScale={0.22}
          normalMap={texture && "normal" in texture ? texture.normal : undefined}
          normalScale={new Vector2(0.35, 0.35)}
        />
      </mesh>
      <mesh ref={accentRef} castShadow scale={[profile.scale[0] * 0.9, profile.scale[1] * 0.7, profile.scale[2] * 0.9]}>
        <sphereGeometry args={[0.5, 20, 20]} />
        <meshPhysicalMaterial
          color={profile.accentColor}
          roughness={Math.min(0.95, profile.roughness + 0.2)}
          metalness={Math.max(0.05, profile.gloss - 0.1)}
          transparent
          opacity={profile.speckle ? 0.35 : 0.2}
        />
      </mesh>
      {/* seam ridge */}
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[profile.scale[0] * 0.6, profile.scale[1] * 0.6, profile.scale[2] * 0.6]}>
        <torusGeometry args={[0.48, 0.04, 12, 48, Math.PI]} />
        <meshPhysicalMaterial
          color={new Color(profile.accentColor).offsetHSL(0, -0.1, -0.15)}
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>
      {/* hilum spot */}
      <mesh position={[profile.scale[0] * 0.25, -profile.scale[1] * 0.15, profile.scale[2] * 0.12]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshPhysicalMaterial
          color={new Color(profile.accentColor).offsetHSL(0, 0.05, -0.25)}
          roughness={0.9}
          metalness={0.02}
        />
      </mesh>
      {/* crop-specific embellishments */}
      {crop.toLowerCase().includes("cotton") && (
        <group position={[0, 0.15, 0]}>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.45, 0.1, Math.sin(angle) * 0.35]}
                scale={[0.15, 0.1, 0.12]}
              >
                <sphereGeometry args={[0.4, 8, 8]} />
                <meshStandardMaterial color="#f4efe7" roughness={0.95} />
              </mesh>
            );
          })}
        </group>
      )}
      {crop.toLowerCase().includes("rice") && (
        <mesh position={[0, 0, 0]} scale={[1.6, 0.35, 0.45]}>
          <capsuleGeometry args={[0.3, 1.1, 10, 18]} />
          <meshStandardMaterial color="#efe3c7" roughness={0.7} />
        </mesh>
      )}
      {crop.toLowerCase().includes("wheat") && (
        <mesh position={[0, 0, 0]} scale={[1.45, 0.4, 0.55]}>
          <capsuleGeometry args={[0.35, 0.9, 10, 18]} />
          <meshStandardMaterial color="#d8b979" roughness={0.65} />
        </mesh>
      )}
      {crop.toLowerCase().includes("maize") && (
        <group position={[0, 0, 0]}>
          <mesh scale={[1.35, 0.5, 0.65]}>
            <cylinderGeometry args={[0.45, 0.6, 1.0, 18]} />
            <meshStandardMaterial color="#f1c44f" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.2, 0.3]} scale={[0.9, 0.08, 0.25]}>
            <boxGeometry args={[0.6, 0.15, 0.25]} />
            <meshStandardMaterial color="#e3b23f" roughness={0.7} />
          </mesh>
        </group>
      )}
      {crop.toLowerCase().includes("bajra") && (
        <mesh position={[0, 0, 0]} scale={[0.9, 0.85, 0.85]}>
          <sphereGeometry args={[0.7, 20, 20]} />
          <meshStandardMaterial color="#c9a06e" roughness={0.85} />
        </mesh>
      )}
      {crop.toLowerCase().includes("gram") && (
        <group position={[0, 0, 0]}>
          <mesh position={[-0.18, 0.02, 0]} scale={[0.75, 0.75, 0.75]}>
            <sphereGeometry args={[0.7, 20, 20]} />
            <meshStandardMaterial color="#caa06a" roughness={0.78} />
          </mesh>
          <mesh position={[0.18, -0.05, 0]} scale={[0.7, 0.7, 0.7]}>
            <sphereGeometry args={[0.7, 20, 20]} />
            <meshStandardMaterial color="#b98957" roughness={0.8} />
          </mesh>
        </group>
      )}
      {crop.toLowerCase().includes("mustard") && (
        <mesh position={[0, 0, 0]} scale={[0.65, 0.65, 0.65]}>
          <sphereGeometry args={[0.7, 20, 20]} />
          <meshStandardMaterial color="#b37b2e" roughness={0.4} metalness={0.15} />
        </mesh>
      )}
      {(crop.toLowerCase().includes("groundnut") || crop.toLowerCase().includes("peanut")) && (
        <mesh position={[0, 0, 0]} scale={[1.3, 0.7, 0.65]}>
          <capsuleGeometry args={[0.35, 0.6, 10, 18]} />
          <meshStandardMaterial color="#c08b5b" roughness={0.7} />
        </mesh>
      )}
      {crop.toLowerCase().includes("soy") && (
        <mesh position={[0, 0, 0]} scale={[1.0, 0.95, 0.95]}>
          <sphereGeometry args={[0.72, 24, 24]} />
          <meshStandardMaterial color="#a67c4f" roughness={0.65} />
        </mesh>
      )}
    </group>
  );
}

function Dust() {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }).map(() => ({
        position: [(Math.random() - 0.5) * 6, (Math.random() - 0.2) * 3, -1.6 - Math.random() * 1.5] as [
          number,
          number,
          number
        ],
        scale: 0.02 + Math.random() * 0.04,
        opacity: 0.25 + Math.random() * 0.25
      })),
    []
  );

  return (
    <group>
      {particles.map((p, i) => (
        <mesh key={i} position={p.position} scale={[p.scale, p.scale, p.scale]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={p.opacity} />
        </mesh>
      ))}
    </group>
  );
}

function Backdrop() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]} receiveShadow>
        <planeGeometry args={[8, 8, 1, 1]} />
        <meshStandardMaterial color="#e7dccb" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -2.6]} receiveShadow>
        <planeGeometry args={[8, 4, 1, 1]} />
        <meshStandardMaterial color="#f4ede2" roughness={1} />
      </mesh>
    </group>
  );
}

type Seed3DViewerProps = {
  seedName?: string;
};

const FALLBACK_PROFILE: SeedVisualProfile = {
  shape: "oval",
  scale: [1.2, 0.8, 0.8],
  baseColor: "#9a764f",
  accentColor: "#caa175",
  gloss: 0.2,
  roughness: 0.6,
  speckle: false
};

export default function Seed3DViewer({ seedName = "" }: Seed3DViewerProps) {
  const [profile, setProfile] = useState<SeedVisualProfile>(FALLBACK_PROFILE);
  const [summary, setSummary] = useState<SeedVisualResponse["summary"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const normalizedSeed = useMemo(() => seedName.trim(), [seedName]);

  useEffect(() => {
    if (!normalizedSeed) return;
    let isActive = true;
    const controller = new AbortController();
    setIsLoading(true);
    const timer = setTimeout(() => {
      fetch(getApiUrl(`/api/seed-visual?seed_name=${encodeURIComponent(normalizedSeed)}`), { signal: controller.signal })
        .then((res) => res.json())
        .then((data: SeedVisualResponse) => {
          if (!isActive) return;
          if (data?.profile) setProfile(data.profile);
          if (data?.summary) setSummary(data.summary);
        })
        .catch(() => null)
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    }, 250);

    return () => {
      isActive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [normalizedSeed]);

  return (
    <div className="seed-canvas">
      <div className="absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-[10px] text-seed-dark shadow">
        {isLoading ? "Generating 3D seed…" : "Live 3D Seed"}
      </div>
      {summary && (
        <div className="absolute right-3 top-3 rounded-2xl bg-white/90 px-3 py-2 text-[10px] text-seed-dark shadow">
          <div className="font-semibold">{summary.topCrop || "Seed Profile"}</div>
          <div>{summary.topSeedType || "Type"} · {summary.topSeedQuality || "Quality"}</div>
        </div>
      )}
      <Canvas shadows camera={{ position: [0, 0.1, 3.2], fov: 45 }}>
        <color attach="background" args={["#f7f1e8"]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[2.8, 3.6, 2.2]}
          intensity={1.25}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={10}
        />
        <directionalLight position={[-2.2, 1.8, -1.6]} intensity={0.5} color="#f1e2ce" />
        <hemisphereLight intensity={0.55} color="#fff3e1" groundColor="#c6b39d" />
        <Environment preset="studio" />
        <Backdrop />
        <ContactShadows position={[0, -0.9, 0]} opacity={0.5} blur={2.5} scale={6} />
        <Dust />
        <group castShadow>
          <SeedMesh profile={profile} crop={summary?.topCrop || ""} />
        </group>
      </Canvas>
    </div>
  );
}
