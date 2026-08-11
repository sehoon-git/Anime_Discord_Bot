import LegalDocument from "../_components/LegalDocument";
import { legalDocs } from "../legalDocs";

export default function TermsPage() {
  return <LegalDocument {...legalDocs.terms} />;
}