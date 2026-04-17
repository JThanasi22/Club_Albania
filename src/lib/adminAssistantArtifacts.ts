export type AdminChatArtifact = {
  url: string;
  label: string;
  mimeType?: string;
};

export function mergeArtifactsUnique(
  existing: AdminChatArtifact[],
  incoming: AdminChatArtifact[]
): AdminChatArtifact[] {
  const seen = new Set(existing.map((a) => a.url));
  const out = [...existing];
  for (const a of incoming) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    out.push(a);
  }
  return out;
}
