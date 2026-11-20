import { ArtifactExportFormats, type ArtifactExportFormat } from "@/features/artifacts/interfaces/artifacts.interfaces";

/** Download formats (§7.5). Which ones an artifact offers depends on its type (see `exportFormatsFor`). */
export const ArtifactExportFormOptions: { id: ArtifactExportFormat; label: string }[] = [
  { id: ArtifactExportFormats.PDF, label: "PDF" },
  { id: ArtifactExportFormats.PPTX, label: "PowerPoint (.pptx)" },
  { id: ArtifactExportFormats.DOCX, label: "Word (.docx)" },
  { id: ArtifactExportFormats.PNG, label: "Image (.png)" },
  { id: ArtifactExportFormats.HTML, label: "Web page (.html)" },
];
