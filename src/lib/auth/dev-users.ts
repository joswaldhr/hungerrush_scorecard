export interface DevUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const DEV_USERS: DevUser[] = [
  {
    id: "dev-manager-pos",
    email: "james.smith@hungerrush.dev",
    name: "James Smith",
    role: "manager",
  },
  {
    id: "dev-manager-menufy",
    email: "maria.garcia@hungerrush.dev",
    name: "Maria Garcia",
    role: "manager",
  },
];
