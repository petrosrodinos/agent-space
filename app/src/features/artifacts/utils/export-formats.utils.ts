import { ArtifactExportFormats, ArtifactTypes, type ArtifactExportFormat, type ArtifactType } from "../interfaces/artifacts.interfaces";

/** Mirrors the API: PDF, image and web page for everything; PowerPoint for slide decks; Word for documents. */
export const exportFormatsFor = (type: ArtifactType): ArtifactExportFormat[] => [
  ArtifactExportFormats.PDF,
  ...(type === ArtifactTypes.PRESENTATION ? [ArtifactExportFormats.PPTX] : []),
  ...(type === ArtifactTypes.DOCUMENT ? [ArtifactExportFormats.DOCX] : []),
  ArtifactExportFormats.PNG,
  ArtifactExportFormats.HTML,
];
