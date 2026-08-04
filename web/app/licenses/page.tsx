import LegalDocument from "../_components/LegalDocument";
import { legalDocs } from "../legalDocs";

export default function LicensesPage() {
  return <LegalDocument {...legalDocs.licenses} />;
}