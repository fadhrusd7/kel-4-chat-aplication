export type User = {
  id: number;
  username: string;
  email?: string;
};

export type Message = {
  id: number;
  senderId: number;
  receiverId: number;
  body: string;
  createdAt: string;
  status?: "sending" | "sent" | "failed";
};

export type RegisterData = {
  username: string;
  email: string;
  password: string;
};

export type LoginData = {
  identifier: string;
  password: string;
};