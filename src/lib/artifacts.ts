export interface Artifact {
  slug: string;
  title: string;
  description: string;
  author: string;
  createdAt: string;
  tags: string[];
  file: string;
}

const artifacts: Artifact[] = [
  {
    slug: "electronics-guide",
    title: "Electrons at Work — A Field Guide to Electricity",
    description: "An interactive visual guide to electronics fundamentals: circuits, components, and how electricity works.",
    author: "Claude",
    createdAt: "2025-04-30",
    tags: ["electronics", "education", "interactive"],
    file: "electronics-guide.html",
  },
  {
    slug: "genki-study",
    title: "げんき Study — GENKI I",
    description: "A Japanese study tool for GENKI I vocabulary and grammar, with flashcards and quiz modes.",
    author: "Claude",
    createdAt: "2025-04-30",
    tags: ["japanese", "language", "study"],
    file: "genki-study.html",
  },
];

export function getAllArtifacts(): Artifact[] {
  return artifacts;
}

export function getArtifact(slug: string): Artifact | undefined {
  return artifacts.find((a) => a.slug === slug);
}

export function searchArtifacts(query: string): Artifact[] {
  const q = query.toLowerCase();
  return artifacts.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.author.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
  );
}
