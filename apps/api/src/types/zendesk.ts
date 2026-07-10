export interface ZendeskTicket {
  id: number;
  status: string;
  assignee_id: number;
  created_at: string;
  updated_at: string;
  satisfaction_rating: {
    score: string;
  } | null;
}

export interface ZendeskSearchResponse {
  results: ZendeskTicket[];
  next_page: string | null;
  count: number;
}

export interface ZendeskTimeMetric {
  calendar: number;
  business: number;
}

export interface ZendeskTicketMetricSet {
  id: number;
  ticket_id: number;
  reply_time_in_minutes: ZendeskTimeMetric | null;
  full_resolution_time_in_minutes: ZendeskTimeMetric | null;
}

export interface ZendeskShowManyResponse {
  tickets: ZendeskTicket[];
  metric_sets: ZendeskTicketMetricSet[];
}

// One answered CSAT survey (score=received filter: good/bad only, with or without
// comment — the *_with_comment variants are filter values, not stored scores).
export interface ZendeskSatisfactionRating {
  id: number;
  assignee_id: number | null;
  score: string;
  created_at: string;
  ticket_id: number;
}

export interface ZendeskSatisfactionRatingsResponse {
  satisfaction_ratings: ZendeskSatisfactionRating[];
  next_page: string | null;
  count: number;
}

export interface ZendeskSlaPolicyMetric {
  priority: string;
  metric: string;
  target: number;
  business_hours: boolean;
}

export interface ZendeskSlaPolicy {
  id: number;
  title: string;
  policy_metrics: ZendeskSlaPolicyMetric[];
}

export interface ZendeskSlaPoliciesResponse {
  sla_policies: ZendeskSlaPolicy[];
}

export interface ZendeskUser {
  id: number;
  email: string;
  active: boolean;
}

export interface ZendeskUsersResponse {
  users: ZendeskUser[];
  next_page: string | null;
  meta?: { has_more: boolean };
  links?: { next: string | null };
}

export interface ZendeskCall {
  id: number;
  agent_id: number | null;
  direction: 'inbound' | 'outbound';
  completion_status: string; // 'completed', 'abandoned', 'declined', 'missed', etc.
  talk_time: number; // in seconds
  duration: number; // in seconds
  created_at: string;
}

export interface ZendeskCallsResponse {
  calls: ZendeskCall[];
  next_page: string | null;
}
