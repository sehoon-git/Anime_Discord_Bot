import LegalDocument from "../_components/LegalDocument";
import { legalDocs } from "../legalDocs";

export default function PrivacyPage() {
  return <LegalDocument {...legalDocs.privacy} />;
}