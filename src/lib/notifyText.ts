/**
 * How the reminder offset reads on the settings screen.
 *
 * Zero is its own case because "0 minutes before prayer" is a clumsy way of
 * saying "on time", and one needs the singular - the old copy always said
 * "minutes" and so read "Notify 1 minutes before prayer".
 */
export function describeNotifyMinutes(minutes: number): string {
  if (minutes <= 0) {
    return "Notify when it is time to pray";
  }
  if (minutes === 1) {
    return "Notify 1 minute before prayer";
  }
  return `Notify ${minutes} minutes before prayer`;
}
