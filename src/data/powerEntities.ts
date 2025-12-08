// powerEntities.ts
// Static data for the 10 power entities in the questionnaire
// Each entity has i18n keys for title and description

export type PowerEntity = {
  id: string;
  titleKey: string;    // i18n key for short title
  descKey: string;     // i18n key for full description with reflection question
};

export const POWER_ENTITIES: PowerEntity[] = [
  {
    id: "leaders",
    titleKey: "POWER_Q_LEADERS_TITLE",
    descKey: "POWER_Q_LEADERS_DESC",
  },
  {
    id: "legislators",
    titleKey: "POWER_Q_LEGISLATORS_TITLE",
    descKey: "POWER_Q_LEGISLATORS_DESC",
  },
  {
    id: "judges",
    titleKey: "POWER_Q_JUDGES_TITLE",
    descKey: "POWER_Q_JUDGES_DESC",
  },
  {
    id: "bureaucracy",
    titleKey: "POWER_Q_BUREAUCRACY_TITLE",
    descKey: "POWER_Q_BUREAUCRACY_DESC",
  },
  {
    id: "enforcers",
    titleKey: "POWER_Q_ENFORCERS_TITLE",
    descKey: "POWER_Q_ENFORCERS_DESC",
  },
  {
    id: "wealthy",
    titleKey: "POWER_Q_WEALTHY_TITLE",
    descKey: "POWER_Q_WEALTHY_DESC",
  },
  {
    id: "media",
    titleKey: "POWER_Q_MEDIA_TITLE",
    descKey: "POWER_Q_MEDIA_DESC",
  },
  {
    id: "religion",
    titleKey: "POWER_Q_RELIGION_TITLE",
    descKey: "POWER_Q_RELIGION_DESC",
  },
  {
    id: "experts",
    titleKey: "POWER_Q_EXPERTS_TITLE",
    descKey: "POWER_Q_EXPERTS_DESC",
  },
  {
    id: "people",
    titleKey: "POWER_Q_PEOPLE_TITLE",
    descKey: "POWER_Q_PEOPLE_DESC",
  },
];
