import LegalDocument from "../_components/LegalDocument";
import { legalDocs } from "../legalDocs";

export default function VoicePolicyPage() {
  return <LegalDocument {...legalDocs.voicePolicy} />;
}