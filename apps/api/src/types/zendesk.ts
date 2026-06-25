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
