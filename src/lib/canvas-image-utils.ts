export type CensorMode = "pixelate" | "blur" | "solid";

export function normalizeBox(x: number, y: number, w: number, h: number) {
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;
  if (nw < 0) {
    nx += nw;
    nw = -nw;
  }
  if (nh < 0) {
    ny += nh;
    nh = -nh;
  }
  return { x: nx, y: ny, width: nw, height: nh };
}

export function pixelateImageData(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blockSize = 14
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const bw = Math.max(2, Math.floor(blockSize));

  for (let y = 0; y < height; y += bw) {
    for (let x = 0; x < width; x += bw) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let dy = 0; dy < bw && y + dy < height; dy++) {
        for (let dx = 0; dx < bw && x + dx < width; dx++) {
          const i = ((y + dy) * width + (x + dx)) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count++;
        }
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);
      for (let dy = 0; dy < bw && y + dy < height; dy++) {
        for (let dx = 0; dx < bw && x + dx < width; dx++) {
          const i = ((y + dy) * width + (x + dx)) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function processRegionFromDataUrl(
  dataUrl: string,
  mode: CensorMode,
  solidColor = "#94a3b8"
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  if (mode === "solid") {
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  ctx.drawImage(img, 0, 0);
  if (mode === "blur") {
    ctx.filter = "blur(10px)";
    ctx.drawImage(img, 0, 0);
    ctx.filter = "none";
  } else {
    pixelateImageData(ctx, canvas.width, canvas.height);
  }
  return canvas.toDataURL("image/png");
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function cropImageDataUrl(
  src: string,
  crop: { x: number; y: number; width: number; height: number }
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width));
  canvas.height = Math.max(1, Math.round(crop.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}
