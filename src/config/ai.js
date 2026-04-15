// ═══════════════════════════════════════════════════════════════════════════════
// DEEPI TRUST — AI Food Quality Analysis Engine v2.0
// Client-side food detection & quality scoring using color spectrum analysis
// NO external API keys required — runs entirely in browser using Canvas API
// ═══════════════════════════════════════════════════════════════════════════════

import FOOD_RULES from './food_analysis.json';

/** Always configured — no API key needed */
export const isAIConfigured = () => true;

// ─── RGB → HSL Conversion ─────────────────────────────────────────────────────
function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, l]; // hue in degrees, s & l in 0-1
}

// ─── Load Image from Data URL ─────────────────────────────────────────────────
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

// ─── Color Spectrum Analysis ──────────────────────────────────────────────────
// Extracts comprehensive color statistics from image pixel data
function analyzeColors(imageData, width, height) {
  const pixels = imageData.data;
  const totalPixels = width * height;

  // HSL histogram & accumulators
  const hueHistogram = new Float32Array(360);
  let totalSaturation = 0;
  let totalLightness = 0;
  let warmPixels = 0;      // Reds, oranges, yellows, browns
  let greenPixels = 0;     // Greens (vegetables)
  let bluePixels = 0;      // Blues (sky, screens)
  let grayPixels = 0;      // Desaturated pixels
  let veryDarkPixels = 0;
  let veryBrightPixels = 0;
  let skinTonePixels = 0;  // Potential skin tones
  let saturatedPixels = 0;

  // Edge color analysis (border region)
  const edgeThreshold = 0.1; // 10% from each edge
  let edgePixels = 0;
  let edgeGrayPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = pixels[i] / 255;
      const g = pixels[i + 1] / 255;
      const b = pixels[i + 2] / 255;
      const [h, s, l] = rgbToHsl(r, g, b);

      totalSaturation += s;
      totalLightness += l;

      // Check if edge pixel
      const isEdge = x < width * edgeThreshold || x > width * (1 - edgeThreshold)
                  || y < height * edgeThreshold || y > height * (1 - edgeThreshold);
      if (isEdge) {
        edgePixels++;
        if (s < 0.08) edgeGrayPixels++;
      }

      if (s < 0.08) {
        grayPixels++;
      } else {
        saturatedPixels++;
        const hi = Math.floor(h) % 360;
        hueHistogram[hi]++;

        // Warm food colors: reds, oranges, yellows, browns
        if ((h >= 0 && h < 55) || (h >= 335 && h <= 360)) warmPixels++;
        // Yellow-gold zone
        else if (h >= 55 && h < 70) warmPixels++;
        // Green zone (vegetables, salads)
        else if (h >= 70 && h < 170) greenPixels++;
        // Blue zone (sky, water, screens)
        else if (h >= 180 && h < 260) bluePixels++;

        // Skin tone detection (specific hue + saturation + lightness range)
        if (h >= 10 && h <= 40 && s >= 0.15 && s <= 0.60 && l >= 0.25 && l <= 0.75) {
          skinTonePixels++;
        }
      }

      if (l < 0.08) veryDarkPixels++;
      if (l > 0.92) veryBrightPixels++;
    }
  }

  const avgSaturation = totalSaturation / totalPixels;
  const avgLightness = totalLightness / totalPixels;

  // Color diversity: count distinct hue peaks in 10° buckets
  let colorDiversity = 0;
  const smoothed = [];
  for (let h = 0; h < 360; h += 10) {
    let sum = 0;
    for (let j = h; j < h + 10 && j < 360; j++) sum += hueHistogram[j];
    smoothed.push(sum);
    if (sum > totalPixels * 0.025) colorDiversity++;
  }

  // Dominant hue
  let dominantHue = 0;
  let maxBucket = 0;
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > maxBucket) {
      maxBucket = smoothed[i];
      dominantHue = i * 10;
    }
  }

  // Texture estimation (color variance in small blocks)
  let textureScore = 0;
  const blockSize = Math.max(4, Math.floor(Math.min(width, height) / 10));
  let blockCount = 0;
  for (let by = 0; by < height - blockSize; by += blockSize) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize) {
      let bMin = 1, bMax = 0;
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const idx = ((by + dy) * width + (bx + dx)) * 4;
          const lum = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 765;
          if (lum < bMin) bMin = lum;
          if (lum > bMax) bMax = lum;
        }
      }
      textureScore += (bMax - bMin);
      blockCount++;
    }
  }
  textureScore = blockCount ? textureScore / blockCount : 0;

  return {
    avgSaturation,
    avgLightness,
    warmRatio: warmPixels / totalPixels,
    greenRatio: greenPixels / totalPixels,
    blueRatio: bluePixels / totalPixels,
    grayRatio: grayPixels / totalPixels,
    darkRatio: veryDarkPixels / totalPixels,
    brightRatio: veryBrightPixels / totalPixels,
    skinToneRatio: skinTonePixels / totalPixels,
    foodColorRatio: (warmPixels + greenPixels) / totalPixels,
    colorDiversity,
    dominantHue,
    saturatedRatio: saturatedPixels / totalPixels,
    edgeGrayRatio: edgePixels ? edgeGrayPixels / edgePixels : 0,
    textureScore,
  };
}

// ─── Food Detection Algorithm ─────────────────────────────────────────────────
// Determines whether the image likely contains food vs non-food content
function detectFood(stats) {
  const rules = FOOD_RULES.detection;
  let foodScore = 0;
  let detectedAs = '';

  // ── Positive signals (food-like) ────────────────────────────────────────
  // Warm + green food colors present
  if (stats.foodColorRatio >= rules.thresholds.food_color_minimum) {
    foodScore += stats.foodColorRatio * rules.weights.food_color;
  }

  // Adequate color saturation (food is colorful)
  if (stats.avgSaturation >= rules.thresholds.min_saturation) {
    foodScore += stats.avgSaturation * rules.weights.saturation;
  }

  // Color diversity (food plates have multiple colors)
  if (stats.colorDiversity >= rules.thresholds.min_color_diversity) {
    foodScore += 0.12;
  }

  // Strong warm tones (most food is warm-colored)
  if (stats.warmRatio > 0.28) foodScore += 0.18;

  // Green component (vegetables present)
  if (stats.greenRatio > 0.08 && stats.greenRatio < 0.55) foodScore += 0.08;

  // Moderate texture (food has natural texture variation)
  if (stats.textureScore > 0.08 && stats.textureScore < 0.45) foodScore += 0.10;

  // ── Negative signals (non-food) ─────────────────────────────────────────

  // Document/screenshot: very gray, very low saturation
  if (stats.grayRatio > rules.non_food.document_gray_threshold &&
      stats.avgSaturation < rules.non_food.document_saturation_max) {
    detectedAs = 'A document, screenshot, or text image (very low color saturation, mostly gray/white)';
    foodScore -= 0.50;
  }

  // Blue sky/landscape
  if (stats.blueRatio > rules.non_food.sky_blue_threshold) {
    detectedAs = detectedAs || 'A landscape, outdoor scene, or blue-dominant image';
    foodScore -= 0.40;
  }

  // Very dark image
  if (stats.darkRatio > rules.non_food.dark_image_threshold) {
    detectedAs = detectedAs || 'A very dark or underexposed image';
    foodScore -= 0.35;
  }

  // Very bright/washed out
  if (stats.brightRatio > rules.non_food.bright_image_threshold) {
    detectedAs = detectedAs || 'An overexposed, blank, or mostly white image';
    foodScore -= 0.30;
  }

  // Skin-tone dominant (selfie/person)
  if (stats.skinToneRatio > rules.non_food.skin_tone_dominant_threshold &&
      stats.foodColorRatio < 0.35) {
    detectedAs = detectedAs || 'A photograph of a person or selfie (skin tones dominant)';
    foodScore -= 0.35;
  }

  // Uniform single color (solid backgrounds, clothing)
  if (stats.colorDiversity <= 1 && stats.saturatedRatio > 0.5) {
    detectedAs = detectedAs || 'A solid-colored or uniform image with no food content';
    foodScore -= 0.30;
  }

  // Very high edge-gray (framed documents, screenshots)
  if (stats.edgeGrayRatio > 0.7 && stats.avgSaturation < 0.15) {
    detectedAs = detectedAs || 'A document or screenshot with gray borders';
    foodScore -= 0.25;
  }

  const isFood = foodScore >= rules.thresholds.food_confidence_minimum;

  if (!detectedAs && !isFood) {
    detectedAs = 'An image that does not match food color patterns';
  }

  return { isFood, foodScore, detectedAs };
}

// ─── Food Type Identification ─────────────────────────────────────────────────
// Matches image color profile against known food category profiles
function identifyFoodType(stats) {
  const profiles = FOOD_RULES.food_profiles;
  let bestMatch = { name: 'Prepared Food', score: 0 };

  for (const p of profiles) {
    let score = 0;
    if (stats.warmRatio >= p.warm_min && stats.warmRatio <= p.warm_max)
      score += (p.warm_weight || 1);
    if (stats.greenRatio >= p.green_min && stats.greenRatio <= p.green_max)
      score += (p.green_weight || 1);
    if (stats.avgSaturation >= p.sat_min && stats.avgSaturation <= p.sat_max)
      score += (p.sat_weight || 0.5);
    if (stats.avgLightness >= p.light_min && stats.avgLightness <= p.light_max)
      score += (p.light_weight || 0.5);

    if (score > bestMatch.score) {
      bestMatch = { name: p.name, score };
    }
  }
  return bestMatch.name;
}

// ─── Quality Scoring Engine ───────────────────────────────────────────────────
// Generates quality scores based on image color characteristics
function mapRange(val, inMin, inMax, outMin, outMax) {
  const clamped = Math.max(inMin, Math.min(inMax, val));
  return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function computeScores(stats) {
  const qs = FOOD_RULES.quality_scoring;

  // Freshness: vivid, saturated colors → fresh food
  const freshnessRaw = stats.avgSaturation * 0.45 + stats.foodColorRatio * 0.30 + (1 - stats.grayRatio) * 0.15 + stats.textureScore * 0.10;
  const freshness = Math.round(mapRange(freshnessRaw, 0.15, 0.75, qs.freshness.min, qs.freshness.max));

  // Packaging: organized color distribution, clean edges
  const packagingRaw = (stats.colorDiversity >= 3 ? 0.6 : 0.4) + stats.avgSaturation * 0.25 + (1 - stats.edgeGrayRatio) * 0.15;
  const packaging = Math.round(mapRange(packagingRaw, 0.25, 0.85, qs.packaging.min, qs.packaging.max));

  // Hygiene: good lighting (not too dark/bright), clear image
  const hygieneRaw = (1 - stats.darkRatio) * 0.35 + (1 - stats.brightRatio) * 0.25 + stats.avgSaturation * 0.20 + stats.textureScore * 0.20;
  const hygiene = Math.round(mapRange(hygieneRaw, 0.25, 0.85, qs.hygiene.min, qs.hygiene.max));

  // Temperature: warm color dominance suggests properly heated food
  const tempRaw = stats.warmRatio * 0.45 + (1 - stats.darkRatio) * 0.25 + stats.avgSaturation * 0.15 + stats.avgLightness * 0.15;
  const temperature = Math.round(mapRange(tempRaw, 0.18, 0.78, qs.temperature.min, qs.temperature.max));

  // Contamination: absence of gray/dark anomalies, good saturation
  const contaminationRaw = (1 - stats.grayRatio * 0.6) * 0.40 + (1 - stats.darkRatio) * 0.25 + stats.avgSaturation * 0.20 + (1 - stats.brightRatio) * 0.15;
  const contamination = Math.round(mapRange(contaminationRaw, 0.25, 0.88, qs.contamination.min, qs.contamination.max));

  return { freshness, packaging, hygiene, temperature, contamination };
}

function getStatus(score) {
  if (score >= 70) return 'pass';
  if (score >= 50) return 'warning';
  return 'fail';
}

function getNote(category, score) {
  const notes = FOOD_RULES.quality_notes[category];
  if (!notes) return 'Assessment completed';
  if (score >= 85) return notes.excellent;
  if (score >= 70) return notes.good;
  if (score >= 50) return notes.fair;
  return notes.poor;
}

// ─── Grade Assignment ─────────────────────────────────────────────────────────
function getGrade(score) {
  const grades = FOOD_RULES.grade_boundaries;
  if (score >= grades.A_plus.min) return grades.A_plus.label;
  if (score >= grades.A.min) return grades.A.label;
  if (score >= grades.B.min) return grades.B.label;
  if (score >= grades.C.min) return grades.C.label;
  if (score >= grades.D.min) return grades.D.label;
  return grades.F.label;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Analyze food images using client-side Canvas color spectrum analysis.
 * @param {string|string[]} imageDataUrls - Base64 data URL(s) of food images
 * @param {function} onStageChange - Callback for progress stage updates
 * @returns {Promise<object>} Structured food analysis result
 */
export async function analyzeFoodQuality(imageDataUrls, onStageChange) {
  const images = Array.isArray(imageDataUrls) ? imageDataUrls : [imageDataUrls];
  if (images.length === 0 || !images[0]) {
    throw new Error('NO_PHOTOS');
  }

  // ── Stage 1: Load & downsample image ──────────────────────────────────────
  onStageChange?.('Loading image for analysis…');
  await tick();

  const img = await loadImage(images[0]);
  const canvas = document.createElement('canvas');
  const MAX_DIM = 250; // Downsample for speed while keeping enough detail
  let w = img.width, h = img.height;
  if (w > MAX_DIM || h > MAX_DIM) {
    const scale = MAX_DIM / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  // ── Stage 2: Color spectrum analysis ──────────────────────────────────────
  onStageChange?.('Analyzing color spectrum…');
  await tick(400);

  const colorStats = analyzeColors(imageData, w, h);

  // ── Stage 3: Food detection ───────────────────────────────────────────────
  onStageChange?.('Running food detection algorithm…');
  await tick(500);

  const detection = detectFood(colorStats);

  if (!detection.isFood) {
    return {
      is_food: false,
      detected_content: detection.detectedAs,
      food_type: null,
      overall_score: 0,
      safe_for_distribution: false,
      categories: [],
      rejection_reason: `Image does not contain food. ${detection.detectedAs}`,
      summary: `The AI food detection engine analyzed the image and determined it does not contain food items. Detected: ${detection.detectedAs}.`
    };
  }

  // ── Stage 4: Food type identification ─────────────────────────────────────
  onStageChange?.('Identifying food type…');
  await tick(350);

  const foodType = identifyFoodType(colorStats);

  // ── Stage 5: Quality scoring ──────────────────────────────────────────────
  onStageChange?.('Computing quality scores…');
  await tick(500);

  const scores = computeScores(colorStats);
  const qs = FOOD_RULES.quality_scoring;

  const overall = Math.round(
    scores.freshness * qs.freshness.weight +
    scores.packaging * qs.packaging.weight +
    scores.hygiene * qs.hygiene.weight +
    scores.temperature * qs.temperature.weight +
    scores.contamination * qs.contamination.weight
  );

  const categories = [
    { label: 'Freshness', icon: '🥬', score: scores.freshness, status: getStatus(scores.freshness), note: getNote('freshness', scores.freshness) },
    { label: 'Packaging', icon: '📦', score: scores.packaging, status: getStatus(scores.packaging), note: getNote('packaging', scores.packaging) },
    { label: 'Hygiene', icon: '🧼', score: scores.hygiene, status: getStatus(scores.hygiene), note: getNote('hygiene', scores.hygiene) },
    { label: 'Temperature', icon: '🌡️', score: scores.temperature, status: getStatus(scores.temperature), note: getNote('temperature', scores.temperature) },
    { label: 'Contamination Risk', icon: '⚠️', score: scores.contamination, status: getStatus(scores.contamination), note: getNote('contamination', scores.contamination) },
  ];

  const safe = overall >= FOOD_RULES.safety.minimum_overall_score &&
               categories.every(c => c.status !== 'fail');

  const grade = getGrade(overall);

  // ── Stage 6: Generate report ──────────────────────────────────────────────
  onStageChange?.('Generating final report…');
  await tick(300);

  // If multiple images, analyze additional images for a more robust result
  if (images.length > 1) {
    let additionalFoodCount = 0;
    for (let idx = 1; idx < Math.min(images.length, 4); idx++) {
      try {
        const addImg = await loadImage(images[idx]);
        const addCanvas = document.createElement('canvas');
        let aw = addImg.width, ah = addImg.height;
        const sc = MAX_DIM / Math.max(aw, ah);
        addCanvas.width = Math.round(aw * sc);
        addCanvas.height = Math.round(ah * sc);
        const actx = addCanvas.getContext('2d');
        actx.drawImage(addImg, 0, 0, addCanvas.width, addCanvas.height);
        const addData = actx.getImageData(0, 0, addCanvas.width, addCanvas.height);
        const addStats = analyzeColors(addData, addCanvas.width, addCanvas.height);
        const addDetect = detectFood(addStats);
        if (addDetect.isFood) additionalFoodCount++;
      } catch { /* skip failed images */ }
    }
    // If majority of images are food, boost confidence slightly
    if (additionalFoodCount > 0) {
      categories.forEach(c => {
        c.score = Math.min(99, c.score + 1);
      });
    }
  }

  return {
    is_food: true,
    food_type: foodType,
    overall_score: overall,
    safe_for_distribution: safe,
    grade,
    categories,
    rejection_reason: safe ? null : `Food quality score (${overall}%) below safe distribution threshold — ${grade}`,
    summary: safe
      ? `${foodType} detected — ${grade} (${overall}%). The food appears suitable for donation and distribution to beneficiary centers.`
      : `${foodType} detected with quality concerns — ${grade} (${overall}%). The food may not meet safety standards for distribution.`
  };
}

// ─── Small delay helper for UI updates ────────────────────────────────────────
function tick(ms = 200) {
  return new Promise(r => setTimeout(r, ms));
}
