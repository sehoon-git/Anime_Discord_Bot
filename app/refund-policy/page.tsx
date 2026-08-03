import LegalDocument from "../_components/LegalDocument";
import { legalDocs } from "../legalDocs";

export default function RefundPolicyPage() {
  return <LegalDocument {...legalDocs.refundPolicy} />;
}