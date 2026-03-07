import apiClient from "./client";

export type CreateUserPayload = {
  fullName: string;
  email: string;
  username: string;
};

export default async function createUser(payload: CreateUserPayload) {
  const response = await apiClient.post("/post-create-user", payload);
  return response.data;
}