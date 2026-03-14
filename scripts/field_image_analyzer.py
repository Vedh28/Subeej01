import base64
import io
import json
import math
import sys
from typing import Any

import numpy as np
import torch
from PIL import Image


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def normalize_seed(seed_name: str) -> str:
    seed = (seed_name or "").strip()
    return seed if seed else "Not specified"


def decode_image(data_url: str) -> Image.Image:
    if "," not in data_url:
        raise ValueError("Invalid image data URL.")
    encoded = data_url.split(",", 1)[1]
    raw = base64.b64decode(encoded)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def classify_soil(soil_brightness: float, red_bias: float, green_bias: float, saturation: float) -> str:
    if soil_brightness < 0.22:
        return "Black soil"
    if red_bias > 0.07 and soil_brightness < 0.52:
        return "Red soil"
    if soil_brightness > 0.62 and saturation < 0.18:
        return "Sandy soil"
    if soil_brightness < 0.42 and saturation > 0.2:
        return "Clayey soil"
    if green_bias > 0.03:
        return "Alluvial soil"
    return "Loamy soil"


def moisture_label(score: float) -> str:
    if score >= 72:
        return "Wet"
    if score >= 45:
        return "Moderate"
    return "Dry"


def vegetation_label(cover: float) -> str:
    if cover >= 45:
        return "Dense"
    if cover >= 18:
        return "Moderate"
    if cover >= 5:
        return "Sparse"
    return "Bare or very low"


def growth_stage_label(cover: float) -> str:
    if cover < 8:
        return "Bare or pre-sowing"
    if cover < 22:
        return "Early establishment"
    if cover < 50:
        return "Vegetative growth"
    return "Dense canopy"


def compatibility_from_seed(seed_name: str, soil: str, moisture_score: float, cover: float) -> tuple[str, str, str]:
    seed = seed_name.lower().strip()
    if "wheat" in seed:
        if "loamy" in soil.lower() or "clayey" in soil.lower():
            if 40 <= moisture_score <= 72:
                return (
                    "Visually suitable with season check",
                    "Visual condition looks acceptable for wheat if the season is Rabi and drainage is adequate.",
                    "Moderate moisture with loamy or clayey soil is usually favorable for wheat."
                )
        return (
            "Needs season and drainage confirmation",
            "The image alone does not confirm ideal wheat conditions. Wheat still needs Rabi timing and stable drainage.",
            "Check season, waterlogging risk, and temperature before sowing wheat."
        )

    if "soy" in seed:
        if cover >= 10 and moisture_score >= 45:
            return (
                "Appears suitable with rainfall check",
                "Visual field condition is reasonably aligned for soybean, but rainfall and season still need confirmation.",
                "Soybean usually prefers Kharif with good moisture support."
            )
        return (
            "Needs moisture or season support",
            "Visual condition is not strongly aligned for soybean yet. Moisture and seasonal fit should be checked.",
            "Soybean generally performs better with stronger moisture support and Kharif timing."
        )

    if "cotton" in seed:
        return (
            "Needs agronomic confirmation",
            "The image gives only partial visual evidence. Cotton suitability still depends on season, soil depth, and water balance.",
            "Use the field image together with weather and soil context for cotton."
        )

    return (
        "Needs crop-specific confirmation",
        "The image gives field condition signals, but crop suitability still needs agronomic confirmation.",
        "Add crop, season, and weather context for a stronger recommendation."
    )


def build_analysis(data_url: str, seed_name: str) -> dict[str, Any]:
    image = decode_image(data_url)
    image = image.resize((256, 256))

    arr = np.asarray(image).astype(np.float32) / 255.0
    tensor = torch.from_numpy(arr)

    red = tensor[:, :, 0]
    green = tensor[:, :, 1]
    blue = tensor[:, :, 2]
    brightness = (red + green + blue) / 3.0

    max_channel = torch.max(tensor, dim=2).values
    min_channel = torch.min(tensor, dim=2).values
    saturation = (max_channel - min_channel) / (max_channel + 1e-6)

    vegetation_mask = (green > red * 1.05) & (green > blue * 1.05) & (green > 0.20)
    soil_mask = ~vegetation_mask
    if torch.sum(soil_mask).item() == 0:
      soil_mask = torch.ones_like(vegetation_mask, dtype=torch.bool)

    green_cover = float(torch.mean(vegetation_mask.float()).item() * 100.0)
    soil_brightness = float(torch.mean(brightness[soil_mask]).item())
    soil_red = float(torch.mean(red[soil_mask]).item())
    soil_green = float(torch.mean(green[soil_mask]).item())
    soil_blue = float(torch.mean(blue[soil_mask]).item())
    soil_saturation = float(torch.mean(saturation[soil_mask]).item())

    red_bias = soil_red - max(soil_green, soil_blue)
    green_bias = soil_green - max(soil_red, soil_blue)
    soil_type = classify_soil(soil_brightness, red_bias, green_bias, soil_saturation)

    moisture_score = clamp((1.0 - soil_brightness) * 100.0 * 0.75 + soil_saturation * 25.0, 5, 95)
    plant_density_score = clamp(green_cover * 1.55, 0, 95)

    patches = []
    patch_size = 64
    for row in range(0, 256, patch_size):
        for col in range(0, 256, patch_size):
            patch = vegetation_mask[row : row + patch_size, col : col + patch_size]
            patches.append(float(torch.mean(patch.float()).item() * 100.0))
    patch_std = float(np.std(patches)) if patches else 0.0
    field_uniformity_score = clamp(100.0 - patch_std * 2.8, 20, 95)

    health_score = clamp(
        plant_density_score * 0.42 + field_uniformity_score * 0.33 + moisture_score * 0.25,
        20,
        96,
    )

    crop_hint = "Not confidently visible"
    normalized_seed = normalize_seed(seed_name)
    if normalized_seed != "Not specified" and green_cover >= 6:
        crop_hint = normalized_seed

    compatibility, explanation, ideal_conditions = compatibility_from_seed(
        normalized_seed, soil_type, moisture_score, green_cover
    )

    confidence_score = clamp((health_score + field_uniformity_score) / 2.0, 25, 95)

    yield_base = clamp((health_score / 32.0), 0.6, 3.8)
    yield_prediction = [
        {"month": "Apr", "yield": round(yield_base, 2)},
        {"month": "May", "yield": round(yield_base + 0.08, 2)},
        {"month": "Jun", "yield": round(yield_base + 0.15, 2)},
        {"month": "Jul", "yield": round(yield_base + 0.19, 2)},
        {"month": "Aug", "yield": round(yield_base + 0.22, 2)},
    ]

    nutrient_proxy = [
        {"nutrient": "Moisture", "value": round(moisture_score, 1)},
        {"nutrient": "Cover", "value": round(clamp(green_cover, 0, 100), 1)},
        {"nutrient": "Density", "value": round(plant_density_score, 1)},
        {"nutrient": "Uniformity", "value": round(field_uniformity_score, 1)},
    ]

    insights = [
        f"Soil visually appears closest to {soil_type}.",
        f"Vegetation cover is about {round(green_cover)}%, suggesting {growth_stage_label(green_cover).lower()}.",
        f"Estimated field moisture looks {moisture_label(moisture_score).lower()} from the image.",
    ]

    return {
        "soil_analysis": {
            "soil": soil_type,
            "moisture": moisture_label(moisture_score),
            "vegetation": vegetation_label(green_cover),
            "health": f"{round(health_score)}%"
        },
        "seed_data": {
            "seed": normalized_seed,
            "compatibility": compatibility,
            "expected_yield": f"Visual estimate: {round(yield_base, 2)} to {round(yield_base + 0.22, 2)} ton/hectare equivalent",
            "ideal_conditions": ideal_conditions
        },
        "ai_decision": {
            "decision": "SOW" if confidence_score >= 72 else "REVIEW",
            "confidence": f"{confidence_score/100.0:.2f}",
            "explanation": explanation
        },
        "field_details": {
            "detected_crop": crop_hint,
            "growth_stage": growth_stage_label(green_cover),
            "ground_cover_percent": round(green_cover, 1),
            "moisture_score": round(moisture_score, 1),
            "plant_density_score": round(plant_density_score, 1),
            "field_uniformity_score": round(field_uniformity_score, 1)
        },
        "analysis_meta": {
            "source": "pytorch_cv",
            "vision_enabled": True,
            "image_confidence": f"{confidence_score/100.0:.2f}"
        },
        "ai_insights": insights,
        "yield_prediction": yield_prediction,
        "nutrient_data": nutrient_proxy,
        "weather_data": []
    }


def main() -> None:
    payload = json.load(sys.stdin)
    data_url = str(payload.get("image_data_url") or "").strip()
    seed_name = str(payload.get("seed_name") or "").strip()
    if not data_url.startswith("data:image/"):
        raise ValueError("A valid uploaded image is required.")

    result = build_analysis(data_url, seed_name)
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
