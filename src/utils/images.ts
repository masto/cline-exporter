import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_URI_REGEX = /^data:image\/(\w+);base64,(.+)$/s;

interface ExtractedImage {
  /** Relative path from output dir, e.g. "images/001.webp" */
  relativePath: string;
  /** Absolute path where the file was written */
  absolutePath: string;
}

let imageCounter = 0;

/** Reset the image counter — call once per export run. */
export function resetImageCounter(): void {
  imageCounter = 0;
}

/**
 * If the given string is a base64 data URI, extract it to a file
 * in the images/ subdirectory and return the relative path.
 * Otherwise return null (the string is not a data URI).
 */
export async function extractDataUri(
  dataUri: string,
  outputDir: string,
): Promise<ExtractedImage | null> {
  const match = dataUri.match(DATA_URI_REGEX);
  if (!match) return null;

  const extension = match[1];
  const base64Data = match[2];

  imageCounter++;
  const filename = `${String(imageCounter).padStart(3, "0")}.${extension}`;
  const imagesDir = join(outputDir, "images");
  await mkdir(imagesDir, { recursive: true });

  const absolutePath = join(imagesDir, filename);
  const buffer = Buffer.from(base64Data, "base64");
  await writeFile(absolutePath, buffer);

  return {
    relativePath: `images/${filename}`,
    absolutePath,
  };
}

/**
 * Process an array of image strings — extract any data URIs to files,
 * return an array of src strings (either extracted file paths or originals).
 */
export async function processImages(
  images: string[],
  outputDir: string,
): Promise<string[]> {
  const results: string[] = [];
  for (const img of images) {
    const extracted = await extractDataUri(img, outputDir);
    results.push(extracted ? extracted.relativePath : img);
  }
  return results;
}
