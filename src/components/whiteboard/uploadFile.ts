/** Upload a file (image or blob) to the server */
export async function uploadFile(
  file: File | Blob,
  pageId: string,
  filename?: string,
): Promise<{ id: string; url: string; mimeType: string }> {
  const formData = new FormData();
  if (filename && file instanceof Blob && !(file instanceof File)) {
    formData.append("file", file, filename);
  } else {
    formData.append("file", file);
  }
  formData.append("pageId", pageId);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload fehlgeschlagen");
  }
  return res.json();
}
