export enum LeadStatus {
  NEW = 'new',
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  SOLD = 'sold',
  SOLD_OUT = 'sold_out',
  DISTRIBUTED = 'distributed',
  ARCHIVED = 'archived',
  LOCKED = 'locked',
  BAD = 'bad',
  /** Admin has flagged this lead for manual review (e.g. possible fraud, bad data) */
  MANUAL_REVIEW = 'manual_review',
}
