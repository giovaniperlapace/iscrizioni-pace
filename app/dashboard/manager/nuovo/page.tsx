import { redirect } from 'next/navigation';
import { manualRegistrationPath } from '@/lib/registrations/manual-registration-navigation';

// Keep existing bookmarks usable while opening the form over the participant list.
export default function OperationsNewParticipantPage() {
  redirect(manualRegistrationPath(null, 'manager', true));
}
