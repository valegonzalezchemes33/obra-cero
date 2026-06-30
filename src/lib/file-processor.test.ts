import { describe, it, expect } from "vitest";
import { validateFile } from "./file-processor";

function createMockFile(name: string, type: string, size: number): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

describe("validateFile", () => {
  it("accepts JPEG image", () => {
    const file = createMockFile("foto.jpg", "image/jpeg", 1024);
    expect(validateFile(file)).toBeNull();
  });

  it("accepts PNG image", () => {
    const file = createMockFile("img.png", "image/png", 1024);
    expect(validateFile(file)).toBeNull();
  });

  it("accepts PDF", () => {
    const file = createMockFile("doc.pdf", "application/pdf", 1024);
    expect(validateFile(file)).toBeNull();
  });

  it("accepts text file", () => {
    const file = createMockFile("notas.txt", "text/plain", 1024);
    expect(validateFile(file)).toBeNull();
  });

  it("accepts CSV file", () => {
    const file = createMockFile("data.csv", "text/csv", 1024);
    expect(validateFile(file)).toBeNull();
  });

  it("rejects files over 10MB", () => {
    const file = createMockFile("grande.jpg", "image/jpeg", 11 * 1024 * 1024);
    expect(validateFile(file)).toContain("10MB");
  });

  it("rejects unsupported file types", () => {
    const file = createMockFile("virus.exe", "application/x-msdownload", 1024);
    expect(validateFile(file)).toContain("no soportado");
  });

  it("rejects MP4 video", () => {
    const file = createMockFile("video.mp4", "video/mp4", 1024);
    expect(validateFile(file)).toContain("no soportado");
  });

  it("accepts PDF with empty type if name ends with .pdf", () => {
    const blob = new Blob(["x".repeat(1024)]);
    const file = new File([blob], "documento.pdf", { type: "" });
    expect(validateFile(file)).toBeNull();
  });

  it("accepts WebP image", () => {
    const file = createMockFile("img.webp", "image/webp", 1024);
    expect(validateFile(file)).toBeNull();
  });

  it("accepts GIF image", () => {
    const file = createMockFile("anim.gif", "image/gif", 1024);
    expect(validateFile(file)).toBeNull();
  });
});
