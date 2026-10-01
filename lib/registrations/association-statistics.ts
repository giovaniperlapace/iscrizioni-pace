export type AssociationStatisticsPerson = {
  registrationId: string;
  name: string;
  association: string;
  attendance: string;
};

export type AssociationStatisticsSnapshot = { people: AssociationStatisticsPerson[] };
