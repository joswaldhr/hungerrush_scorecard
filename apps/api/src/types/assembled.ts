export interface AssembledPerson {
  id: string;
  name: string;
  email: string;
  platforms?: {
    zendesk?: string;
  };
}

export interface AssembledAgentState {
  agent_id: string;
  state: string;
  start_time: number;
  end_time: number;
}

export interface AssembledActivity {
  agent_id: string;
  activity_type_id: string;
  start_time: number;
  end_time: number;
}

export interface AssembledActivityType {
  id: string;
  name: string;
  productive: boolean;
}
