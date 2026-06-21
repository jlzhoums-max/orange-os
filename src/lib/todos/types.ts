export type TodoTask = {
  id: string;
  title: string;
  notes: string;
  project: string;
  dueDate: string;
  priority?: 1 | 2 | 3 | 4;
  labels: string[];
  completed: boolean;
  createdAt: string;
  amount?: string;
  flagged?: boolean;
  someday?: boolean;
};

export type TodoTaskPayload = {
  title?: string;
  notes?: string;
  project?: string;
  dueDate?: string;
  priority?: 1 | 2 | 3 | 4;
  labels?: string[];
  completed?: boolean;
  amount?: string;
  flagged?: boolean;
  someday?: boolean;
};
