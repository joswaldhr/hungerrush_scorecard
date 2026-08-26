export interface DevUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const DEV_USERS: DevUser[] = [
  {
    id: "dev-manager-pos",
    email: "alexander.smith@hungerrush.com",
    name: "Alexander Smith",
    role: "manager",
  },
  {
    id: "dev-manager-menufy",
    email: "barbara.maenza@hungerrush.com",
    name: "Barbara Maenza",
    role: "manager",
  },
  {
    id: "dev-admin-james",
    email: "james.oswald@hungerrush.com",
    name: "James Oswald",
    role: "admin",
  },
];
