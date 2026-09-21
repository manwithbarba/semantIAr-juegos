import SnomedExplorer from "@/components/SnomedExplorer";

export const metadata = {
  title: "Explorador educativo de conceptos clínicos anotados | SEMANTIAR",
  description: "Recurso educativo para revisar el uso, la jerarquía SNOMED CT y la similitud terminológica de conceptos clínicos anotados.",
};

export default function ExplorerPage() {
  return <SnomedExplorer />;
}
