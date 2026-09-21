import SnomedExplorer from "@/components/SnomedExplorer";

export const metadata = {
  title: "Explorador de conceptos clínicos anotados | SEMANTIAR",
  description: "Vista pública agregada de conceptos clínicos anotados y sus relaciones en SNOMED CT.",
};

export default function ExplorerPage() {
  return <SnomedExplorer />;
}
