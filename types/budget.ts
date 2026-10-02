export interface Budget {
  id: string;
  month: Date; // first day of month, local time
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}
